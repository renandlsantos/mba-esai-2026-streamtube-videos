import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { createTestDataSource } from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { Video } from './entities/video.entity';
import { VideosRepository } from './repositories/videos.repository';
import { VideoProcessingService } from './video-processing.service';
import { VideoQueueService } from './video-queue.service';
import { VIDEO_QUEUE, VideoJob } from './video.constants';

jest.setTimeout(15000);
it('reconciles real BullMQ deferred failure, preserves ready and recovers a missed event after restart', async () => {
  const db = createTestDataSource(
    [User, Channel, RefreshToken, VerificationToken, Video],
    { synchronize: false },
  );
  await db.initialize();
  const queue = new Queue<VideoJob>(VIDEO_QUEUE, {
    connection: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });
  const processing = {
    process: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
  const module = await Test.createTestingModule({
    providers: [
      VideoQueueService,
      VideosRepository,
      { provide: DataSource, useValue: db },
      { provide: VideoProcessingService, useValue: processing },
    ],
  }).compile();
  const service = module.get(VideoQueueService);
  const userId = randomUUID();
  const ids = [randomUUID(), randomUUID()];
  try {
    await db.getRepository(User).save({
      id: userId,
      email: `${userId}@example.com`,
      password: 'test-only',
      is_confirmed: true,
    });
    const channel = await db
      .getRepository(Channel)
      .save({ user_id: userId, name: 'Queue regression', nickname: userId });
    for (let i = 0; i < ids.length; i++) {
      await db.getRepository(Video).save({
        id: ids[i],
        slug: ids[i],
        channel_id: channel.id,
        title: 'Deferred failure',
        size_bytes: 1,
        content_type: 'video/mp4',
        object_key: `test/${ids[i]}`,
        status: i === 0 ? 'processing' : 'ready',
        enqueue_pending: false,
      });
      await queue.add(
        'process-video',
        { version: 1, videoId: ids[i] },
        { jobId: ids[i], attempts: 3, removeOnFail: false },
      );
      // BullMQ's stalled script persists this field when maxStalledCount is exceeded.
      // The real Worker reads it and fails without invoking the supplied processor.
      await (
        await queue.client
      ).hset(
        queue.toKey(ids[i]),
        'defa',
        'job stalled more than allowable limit',
      );
    }
    await service.start();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const video = await db
        .getRepository(Video)
        .findOneByOrFail({ id: ids[0] });
      if (
        video.status === 'error' &&
        (await queue.getJobState(ids[1])) === 'failed'
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(processing.process).not.toHaveBeenCalled();
    expect(await queue.getJobState(ids[0])).toBe('failed');
    expect(await queue.getJobState(ids[1])).toBe('failed');
    expect(
      await db.getRepository(Video).findOneByOrFail({ id: ids[0] }),
    ).toMatchObject({ status: 'error', error_code: 'VIDEO_PROCESSING_FAILED' });
    expect(
      (await db.getRepository(Video).findOneByOrFail({ id: ids[1] })).status,
    ).toBe('ready');
    await service.onModuleDestroy();
    // Reproduce a crash/DB outage between Redis failure and the DB update.
    await db
      .getRepository(Video)
      .update(ids[0], { status: 'processing', error_code: null });
    await service.start();
    expect(
      (await db.getRepository(Video).findOneByOrFail({ id: ids[0] })).status,
    ).toBe('error');
    expect(
      (await db.getRepository(Video).findOneByOrFail({ id: ids[1] })).status,
    ).toBe('ready');
  } finally {
    await module.close();
    for (const id of ids) await queue.remove(id);
    await queue.close();
    await db.getRepository(Channel).delete({ user_id: userId });
    await db.getRepository(User).delete({ id: userId });
    await db.destroy();
  }
});
