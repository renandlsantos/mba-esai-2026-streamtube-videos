import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { VideosRepository } from './repositories/videos.repository';
import { StorageService } from './storage.service';

const execute = promisify(execFile);
interface Probe {
  format?: { duration?: string; format_name?: string };
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
  }[];
}
@Injectable()
export class VideoProcessingService {
  constructor(
    private readonly videos: VideosRepository,
    private readonly storage: StorageService,
  ) {}
  async process(id: string) {
    const video = await this.videos.findById(id);
    if (!video || video.status === 'ready' || video.status === 'error') return;
    if (video.status !== 'processing')
      throw new Error('Video is not queued for processing');
    const dir = await mkdtemp(join(tmpdir(), 'streamtube-video-'));
    try {
      const input = join(dir, 'input'),
        thumbnail = join(dir, 'thumbnail.jpg');
      await pipeline(
        await this.storage.read(video.object_key),
        createWriteStream(input),
      );
      if ((await stat(input)).size !== video.size_bytes)
        throw new Error('Video size changed');
      const { stdout } = await execute(
        'ffprobe',
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-show_format',
          '-show_streams',
          '-of',
          'json',
          input,
        ],
        { timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
      );
      const probe = JSON.parse(stdout) as Probe;
      const stream = probe.streams?.find((s) => s.codec_type === 'video');
      const duration = Number(probe.format?.duration);
      if (!stream || !Number.isFinite(duration) || duration <= 0)
        throw new Error('Invalid video media');
      await execute(
        'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-ss',
          String(Math.min(1, duration / 2)),
          '-i',
          input,
          '-frames:v',
          '1',
          '-vf',
          'scale=320:-1',
          '-y',
          thumbnail,
        ],
        { timeout: 1200000, maxBuffer: 1024 * 1024 },
      );
      const key = `videos/${video.channel_id}/${id}/thumbnail.jpg`;
      await this.storage.put(
        key,
        createReadStream(thumbnail),
        (await stat(thumbnail)).size,
        'image/jpeg',
      );
      await this.videos.update(id, {
        status: 'ready',
        thumbnail_key: key,
        duration_seconds: duration,
        metadata: {
          width: stream.width,
          height: stream.height,
          codec: stream.codec_name,
          format: probe.format?.format_name,
        },
        error_code: null,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
