import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Channel } from '../src/channels/entities/channel.entity';
import { Video } from '../src/videos/entities/video.entity';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { MAX_VIDEO_BYTES } from '../src/videos/video.constants';

jest.setTimeout(45000);
describe('Videos (real S3, Redis, worker and database e2e)', () => {
  let app: INestApplication<Server>;
  let db: DataSource;
  let token: string;
  let otherToken: string;
  let userId: string;
  let otherId: string;
  let clip: Buffer;
  beforeAll(async () => {
    process.env.S3_PUBLIC_ENDPOINT = 'http://storage:9000';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    db = module.get(DataSource);
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    async function owner() {
      const id = randomUUID();
      await db.getRepository(User).save({
        id,
        email: `${id}@example.com`,
        password: 'not-used-login',
        is_confirmed: true,
      });
      await db
        .getRepository(Channel)
        .save({ user_id: id, name: 'Video test', nickname: id });
      return {
        id,
        token: await jwt.signAsync({
          sub: id,
          email: `${id}@example.com`,
          jti: randomUUID(),
        }),
      };
    }
    const first = await owner(),
      second = await owner();
    token = first.token;
    userId = first.id;
    otherToken = second.token;
    otherId = second.id;
    const dir = await mkdtemp(join(tmpdir(), 'video-fixture-'));
    try {
      const file = join(dir, 'clip.mp4');
      execFileSync('ffmpeg', [
        '-nostdin',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=blue:s=320x240:d=2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-y',
        file,
      ]);
      clip = await readFile(file);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  afterAll(async () => {
    for (const id of [userId, otherId]) {
      if (id) {
        await db.getRepository(Channel).delete({ user_id: id });
        await db.getRepository(User).delete({ id });
      }
    }
    await app.close();
  });
  async function start(size = clip.length) {
    return request(app.getHttpServer())
      .post('/videos/uploads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Generated blue clip',
        size_bytes: size,
        content_type: 'video/mp4',
      });
  }
  async function upload(id: string, body: Buffer) {
    const signed = await request(app.getHttpServer())
      .post(`/videos/${id}/upload-parts/1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const result = await fetch((signed.body as { url: string }).url, {
      method: 'PUT',
      body: new Uint8Array(body),
    });
    expect(result.status).toBe(200);
    return [{ part_number: 1, etag: result.headers.get('etag') }];
  }
  async function waitStatus(id: string, status: string) {
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
      const video = await db.getRepository(Video).findOneByOrFail({ id });
      if (video.status === status) return video;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Worker did not reach ${status}`);
  }
  it('requires JWT, accepts 10GiB metadata and rejects oversize without uploading bytes', async () => {
    await request(app.getHttpServer())
      .post('/videos/uploads')
      .send({})
      .expect(401);
    await start(MAX_VIDEO_BYTES + 1).then((r) => expect(r.status).toBe(400));
    const large = await start(MAX_VIDEO_BYTES);
    expect(large.status).toBe(201);
    expect((large.body as { part_count: number }).part_count).toBe(640);
    const id = (large.body as { id: string }).id;
    for (let part = 1; part <= 12; part++) {
      await request(app.getHttpServer())
        .post(`/videos/${id}/upload-parts/${part}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    }
    // Thirty-five immediate requests are stricter than a minute of 2s polling.
    for (let poll = 0; poll < 35; poll++) {
      await request(app.getHttpServer())
        .get(`/videos/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
    await request(app.getHttpServer())
      .delete(`/videos/${(large.body as { id: string }).id}/upload`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });
  it('processes a real clip automatically and serves partial bytes, thumbnail and attachment', async () => {
    const initial = await start();
    expect(initial.status).toBe(201);
    const id = (initial.body as { id: string }).id;
    expect((initial.body as { status: string }).status).toBe('draft');
    await request(app.getHttpServer()).get(`/videos/${id}/stream`).expect(404);
    await request(app.getHttpServer())
      .post(`/videos/${id}/upload-parts/1`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    const parts = await upload(id, clip);
    await request(app.getHttpServer())
      .post(`/videos/${id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parts })
      .expect(202);
    await request(app.getHttpServer())
      .post(`/videos/${id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parts })
      .expect(202);
    const ready = await waitStatus(id, 'ready');
    expect(ready.duration_seconds).toBeGreaterThan(0);
    expect(ready.metadata?.width).toBe(320);
    const metadata = await request(app.getHttpServer())
      .get(`/videos/${id}`)
      .expect(200);
    expect(
      (metadata.body as { object_key?: string }).object_key,
    ).toBeUndefined();
    const stream = await request(app.getHttpServer())
      .get(`/videos/${id}/stream`)
      .set('Range', 'bytes=0-99')
      .expect(307);
    const partial = await fetch(stream.headers.location, {
      headers: { Range: 'bytes=0-99' },
    });
    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(100);
    const thumbnail = await request(app.getHttpServer())
      .get(`/videos/${id}/thumbnail`)
      .expect(307);
    const image = await fetch(thumbnail.headers.location);
    expect(image.headers.get('content-type')).toContain('image/jpeg');
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(100);
    const download = await request(app.getHttpServer())
      .get(`/videos/${id}/download`)
      .expect(307);
    const file = await fetch(download.headers.location);
    expect(file.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(clip);
  });
  it('records failure for invalid media instead of exposing it', async () => {
    const bad = Buffer.from('this is not a video');
    const initial = await start(bad.length);
    const id = (initial.body as { id: string }).id;
    const parts = await upload(id, bad);
    await request(app.getHttpServer())
      .post(`/videos/${id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ parts })
      .expect(202);
    const failed = await waitStatus(id, 'error');
    expect(failed.error_code).toBe('VIDEO_PROCESSING_FAILED');
    await request(app.getHttpServer())
      .get(`/videos/${id}/download`)
      .expect(404);
  });
});
