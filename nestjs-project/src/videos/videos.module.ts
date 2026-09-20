import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { Video } from './entities/video.entity';
import { VideosRepository } from './repositories/videos.repository';
import { StorageService } from './storage.service';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { VideoProcessingService } from './video-processing.service';
import { VideoQueueService } from './video-queue.service';
@Module({
  imports: [TypeOrmModule.forFeature([Video, Channel])],
  controllers: [VideosController],
  providers: [
    VideosRepository,
    StorageService,
    VideosService,
    VideoProcessingService,
    VideoQueueService,
  ],
  exports: [
    VideosRepository,
    StorageService,
    VideoProcessingService,
    VideoQueueService,
  ],
})
export class VideosModule {}
