import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { Video } from '../entities/video.entity';
import { VideoException } from '../video.exception';

@Injectable()
export class VideosRepository {
  constructor(private readonly dataSource: DataSource) {}
  channelForUser(userId: string) {
    return this.dataSource
      .getRepository(Channel)
      .findOneBy({ user_id: userId });
  }
  save(video: Partial<Video>) {
    return this.dataSource.getRepository(Video).save(video);
  }
  findById(id: string) {
    return this.dataSource
      .getRepository(Video)
      .findOne({ where: { id }, relations: { channel: true } });
  }
  findBySlug(slug: string) {
    return this.dataSource.getRepository(Video).findOneBy({ slug });
  }
  update(id: string, values: Partial<Video>) {
    return this.dataSource.getRepository(Video).update(id, values);
  }
  pending() {
    return this.dataSource.getRepository(Video).find({
      where: { status: 'processing', enqueue_pending: true },
      take: 50,
    });
  }
  withLock<T>(
    id: string,
    action: (video: Video, manager: EntityManager) => Promise<T>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const video = await manager
        .getRepository(Video)
        .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!video)
        throw new VideoException('VIDEO_NOT_FOUND', 404, 'Video not found');
      video.channel = await manager
        .getRepository(Channel)
        .findOneByOrFail({ id: video.channel_id });
      return action(video, manager);
    });
  }
}
