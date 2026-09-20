import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StartUploadDto } from './dto/start-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { Video } from './entities/video.entity';
import { VideosRepository } from './repositories/videos.repository';
import { StorageService } from './storage.service';
import { PART_SIZE } from './video.constants';
import { VideoException } from './video.exception';

@Injectable()
export class VideosService {
  constructor(
    private readonly videos: VideosRepository,
    private readonly storage: StorageService,
  ) {}
  private authorize(video: Video, userId: string) {
    if (video.channel.user_id !== userId)
      throw new VideoException(
        'VIDEO_FORBIDDEN',
        403,
        'Video belongs to another channel',
      );
  }
  async start(userId: string, dto: StartUploadDto) {
    const channel = await this.videos.channelForUser(userId);
    if (!channel)
      throw new VideoException('VIDEO_FORBIDDEN', 403, 'User has no channel');
    const id = randomUUID();
    const video = await this.videos.save({
      id,
      slug: id,
      channel_id: channel.id,
      title: dto.title.trim(),
      size_bytes: dto.size_bytes,
      content_type: dto.content_type,
      status: 'draft',
      object_key: `videos/${channel.id}/${id}/original`,
      enqueue_pending: false,
    });
    try {
      const uploadId = await this.storage.begin(
        video.object_key,
        video.content_type,
      );
      await this.videos.update(id, { upload_id: uploadId });
    } catch (error) {
      await this.videos.update(id, {
        status: 'error',
        error_code: 'UPLOAD_START_FAILED',
      });
      throw error;
    }
    return {
      id,
      slug: id,
      status: 'draft',
      part_size: PART_SIZE,
      part_count: Math.ceil(dto.size_bytes / PART_SIZE),
    };
  }
  async signPart(userId: string, id: string, part: number) {
    const video = await this.owned(userId, id);
    if (video.status !== 'draft' || !video.upload_id)
      throw new VideoException(
        'VIDEO_STATE_CONFLICT',
        409,
        'Upload is not active',
      );
    const count = Math.ceil(video.size_bytes / PART_SIZE);
    if (!Number.isInteger(part) || part < 1 || part > count)
      throw new VideoException(
        'VIDEO_INVALID_UPLOAD',
        400,
        'Invalid part number',
      );
    return {
      url: await this.storage.signPart(
        video.object_key,
        video.upload_id,
        part,
        Math.min(PART_SIZE, video.size_bytes - (part - 1) * PART_SIZE),
      ),
      expires_in: 900,
    };
  }
  async complete(userId: string, id: string, dto: CompleteUploadDto) {
    return this.videos.withLock(id, async (video, manager) => {
      this.authorize(video, userId);
      if (video.status === 'processing' || video.status === 'ready')
        return { id, status: video.status };
      if (video.status !== 'draft' || !video.upload_id)
        throw new VideoException(
          'VIDEO_STATE_CONFLICT',
          409,
          'Upload is not active',
        );
      await this.storage.complete(
        video.object_key,
        video.upload_id,
        dto.parts,
        video.size_bytes,
      );
      video.status = 'processing';
      video.enqueue_pending = true;
      await manager.save(video);
      return { id, status: video.status };
    });
  }
  async cancel(userId: string, id: string) {
    return this.videos.withLock(id, async (video, manager) => {
      this.authorize(video, userId);
      if (video.status !== 'draft' || !video.upload_id)
        throw new VideoException(
          'VIDEO_STATE_CONFLICT',
          409,
          'Upload is not active',
        );
      await this.storage.abort(video.object_key, video.upload_id);
      video.status = 'error';
      video.error_code = 'UPLOAD_CANCELLED';
      await manager.save(video);
    });
  }
  private async owned(userId: string, id: string) {
    const video = await this.videos.findById(id);
    if (!video)
      throw new VideoException('VIDEO_NOT_FOUND', 404, 'Video not found');
    this.authorize(video, userId);
    return video;
  }
  async status(userId: string, id: string) {
    const video = await this.owned(userId, id);
    return { ...this.present(video), error_code: video.error_code };
  }
  private async ready(slug: string) {
    const video = await this.videos.findBySlug(slug);
    if (!video || video.status !== 'ready')
      throw new VideoException('VIDEO_NOT_FOUND', 404, 'Video not found');
    return video;
  }
  private present(video: Video) {
    return {
      id: video.id,
      slug: video.slug,
      title: video.title,
      status: video.status,
      duration_seconds: video.duration_seconds,
      metadata: video.metadata,
    };
  }
  async get(slug: string) {
    return this.present(await this.ready(slug));
  }
  async media(slug: string, kind: 'stream' | 'download' | 'thumbnail') {
    const video = await this.ready(slug);
    const key = kind === 'thumbnail' ? video.thumbnail_key : video.object_key;
    if (!key)
      throw new VideoException('VIDEO_NOT_FOUND', 404, 'Media not found');
    return {
      url: await this.storage.signRead(key, kind === 'download'),
      statusCode: 307,
    };
  }
}
