import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { VideosRepository } from './repositories/videos.repository';
import { VideoProcessingService } from './video-processing.service';
import { VIDEO_QUEUE, VideoJob } from './video.constants';

@Injectable()
export class VideoQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoQueueService.name);
  private queue: Queue<VideoJob> | undefined;
  private worker: Worker<VideoJob> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private dispatching = false;
  private failedOffset = 0;
  private readonly connection = {
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  };
  constructor(
    private readonly videos: VideosRepository,
    private readonly processing: VideoProcessingService,
  ) {}
  async start() {
    this.queue = new Queue<VideoJob>(VIDEO_QUEUE, {
      connection: this.connection,
    });
    this.worker = new Worker<VideoJob>(
      VIDEO_QUEUE,
      async (job) => {
        if (job.data.version !== 1) throw new Error('Unsupported job version');
        await this.processing.process(job.data.videoId);
      },
      { connection: this.connection, concurrency: 1, lockDuration: 60000 },
    );
    this.worker.on('failed', (job) => {
      void this.reconcileFailedJob(job).catch((error) =>
        this.logger.error(String(error)),
      );
    });
    this.worker.on('error', (error) => this.logger.error(error.message));
    this.queue.on('error', (error) => this.logger.error(error.message));
    await this.worker.waitUntilReady();
    this.timer = setInterval(() => {
      void this.dispatch().catch((error) => this.logger.error(String(error)));
    }, 2000);
    await this.dispatch();
  }
  async reconcileFailedJob(job: Job<VideoJob> | undefined) {
    if (job && (await job.getState()) === 'failed') {
      await this.videos.failProcessing(job.data.videoId);
    }
  }
  private async reconcileFailures() {
    if (!this.queue) return;
    const batch = await this.queue.getFailed(
      this.failedOffset,
      this.failedOffset + 49,
    );
    for (const job of batch) await this.reconcileFailedJob(job);
    this.failedOffset = batch.length === 50 ? this.failedOffset + 50 : 0;
  }
  async dispatch() {
    if (!this.queue || this.dispatching) return;
    this.dispatching = true;
    try {
      await this.reconcileFailures();
      for (const video of await this.videos.pending()) {
        await this.queue.add(
          'process-video',
          { version: 1, videoId: video.id },
          {
            jobId: video.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: false,
            removeOnFail: false,
          },
        );
        await this.videos.update(video.id, { enqueue_pending: false });
      }
    } finally {
      this.dispatching = false;
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
