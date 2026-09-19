import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

describe('StorageService real multipart integration', () => {
  let storage: StorageService;
  let module: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
  beforeAll(async () => {
    process.env.S3_PUBLIC_ENDPOINT = 'http://storage:9000';
    module = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();
    storage = module.get(StorageService);
  });
  afterAll(async () => {
    await module.close();
  });
  it('rejects mismatched real parts then completes idempotently with original bytes', async () => {
    const key = `tests/${randomUUID()}`;
    const upload = await storage.begin(key, 'video/mp4');
    const body = Buffer.from('test media bytes');
    try {
      const url = await storage.signPart(key, upload, 1, body.length);
      const result = await fetch(url, {
        method: 'PUT',
        body: new Uint8Array(body),
      });
      expect(result.status).toBe(200);
      const parts = [{ part_number: 1, etag: result.headers.get('etag')! }];
      await expect(
        storage.complete(key, upload, parts, body.length + 1),
      ).rejects.toMatchObject({ errorCode: 'VIDEO_INVALID_UPLOAD' });
      await storage.complete(key, upload, parts, body.length);
      await storage.complete(key, upload, parts, body.length);
      const chunks: Buffer[] = [];
      for await (const chunk of await storage.read(key))
        chunks.push(Buffer.from(chunk as Uint8Array));
      expect(Buffer.concat(chunks)).toEqual(body);
    } finally {
      await storage.client.send(
        new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }),
      );
    }
  });
});
