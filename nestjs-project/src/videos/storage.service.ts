import { Injectable } from '@nestjs/common';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { PART_SIZE } from './video.constants';
import { UploadPartDto } from './dto/complete-upload.dto';
import { VideoException } from './video.exception';

@Injectable()
export class StorageService {
  readonly bucket = process.env.S3_BUCKET ?? 'streamtube-videos';
  private readonly options = {
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'streamtube',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'streamtube-local-secret',
    },
  };
  readonly client = new S3Client({
    ...this.options,
    endpoint: process.env.S3_ENDPOINT ?? 'http://storage:9000',
  });
  private readonly publicClient = new S3Client({
    ...this.options,
    endpoint: process.env.S3_PUBLIC_ENDPOINT ?? 'http://localhost:59000',
  });
  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
      } catch (createError) {
        if ((createError as Error).name !== 'BucketAlreadyOwnedByYou')
          throw createError;
      }
    }
  }
  async begin(key: string, contentType: string) {
    await this.ensureBucket();
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    if (!response.UploadId) throw new Error('Storage did not return upload ID');
    return response.UploadId;
  }
  signPart(key: string, uploadId: string, part: number, length: number) {
    return getSignedUrl(
      this.publicClient,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: part,
        ContentLength: length,
      }),
      { expiresIn: 900, signableHeaders: new Set(['content-length']) },
    );
  }
  async complete(
    key: string,
    uploadId: string,
    parts: UploadPartDto[],
    expectedSize: number,
  ) {
    try {
      const response = await this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MaxParts: 1000,
        }),
      );
      const actual = response.Parts ?? [];
      const expectedCount = Math.ceil(expectedSize / PART_SIZE);
      if (
        response.IsTruncated ||
        actual.length !== expectedCount ||
        parts.length !== expectedCount
      )
        throw new VideoException(
          'VIDEO_INVALID_UPLOAD',
          400,
          'Upload parts are incomplete',
        );
      const sorted = [...parts].sort((a, b) => a.part_number - b.part_number);
      for (let i = 0; i < expectedCount; i++) {
        const size = Math.min(PART_SIZE, expectedSize - i * PART_SIZE);
        if (
          sorted[i].part_number !== i + 1 ||
          actual[i].PartNumber !== i + 1 ||
          actual[i].Size !== size ||
          actual[i].ETag !== sorted[i].etag
        )
          throw new VideoException(
            'VIDEO_INVALID_UPLOAD',
            400,
            'Upload parts or size do not match',
          );
      }
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: sorted.map((p) => ({
              PartNumber: p.part_number,
              ETag: p.etag,
            })),
          },
        }),
      );
    } catch (error) {
      if ((error as Error).name !== 'NoSuchUpload') throw error;
      // A previous attempt may have completed S3 before its database transaction committed.
    }
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (head.ContentLength !== expectedSize)
      throw new VideoException(
        'VIDEO_INVALID_UPLOAD',
        400,
        'Uploaded size does not match',
      );
  }
  async abort(key: string, uploadId: string) {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }
  async read(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!(response.Body instanceof Readable))
      throw new Error('Storage returned no stream');
    return response.Body;
  }
  async put(key: string, body: Readable, size: number, type: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentLength: size,
        ContentType: type,
      }),
    );
  }
  signRead(key: string, download = false) {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(download
          ? { ResponseContentDisposition: 'attachment; filename="video.mp4"' }
          : {}),
      }),
      { expiresIn: 900 },
    );
  }
  onModuleDestroy() {
    this.client.destroy();
    this.publicClient.destroy();
  }
}
