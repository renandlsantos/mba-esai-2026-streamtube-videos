import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
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
        try {
          await this.processing.process(job.data.videoId);
        } catch (error) {
          if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1))
            await this.videos.update(job.data.videoId, {
              status: 'error',
              error_code: 'VIDEO_PROCESSING_FAILED',
            });
          throw error;
        }
      },
      { connection: this.connection, concurrency: 1, lockDuration: 60000 },
    );
    this.worker.on('error', (error) => this.logger.error(error.message));
    this.queue.on('error', (error) => this.logger.error(error.message));
    await this.worker.waitUntilReady();
    this.timer = setInterval(() => {
      void this.dispatch().catch((error) => this.logger.error(String(error)));
    }, 2000);
    await this.dispatch();
  }
  async dispatch() {
    if (!this.queue || this.dispatching) return;
    this.dispatching = true;
    try {
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
