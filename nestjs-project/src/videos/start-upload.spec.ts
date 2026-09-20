import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StartUploadDto } from './dto/start-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { MAX_VIDEO_BYTES } from './video.constants';
import { VideosService } from './videos.service';
import { VideosRepository } from './repositories/videos.repository';
import { StorageService } from './storage.service';

describe('Video upload contracts', () => {
  it('accepts exactly 10GiB and rejects one byte above it', async () => {
    const input = {
      title: 'Video',
      size_bytes: MAX_VIDEO_BYTES,
      content_type: 'video/mp4',
    };
    expect(await validate(plainToInstance(StartUploadDto, input))).toHaveLength(
      0,
    );
    expect(
      await validate(
        plainToInstance(StartUploadDto, {
          ...input,
          size_bytes: MAX_VIDEO_BYTES + 1,
        }),
      ),
    ).not.toHaveLength(0);
  });
  it('rejects zero, non video MIME and empty parts', async () => {
    expect(
      await validate(
        plainToInstance(StartUploadDto, {
          title: '',
          size_bytes: 0,
          content_type: 'text/html',
        }),
      ),
    ).toHaveLength(3);
    expect(
      await validate(plainToInstance(CompleteUploadDto, { parts: [] })),
    ).not.toHaveLength(0);
  });
  it('rejects a whitespace-only title', async () => {
    expect(
      await validate(
        plainToInstance(StartUploadDto, {
          title: '   ',
          size_bytes: 1,
          content_type: 'video/mp4',
        }),
      ),
    ).not.toHaveLength(0);
  });
  it('rejects another channel before signing storage', async () => {
    const storage = { signPart: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        VideosService,
        {
          provide: VideosRepository,
          useValue: {
            findById: jest
              .fn()
              .mockResolvedValue({ channel: { user_id: 'owner' } }),
          },
        },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    await expect(
      module.get(VideosService).signPart('other', 'id', 1),
    ).rejects.toMatchObject({ errorCode: 'VIDEO_FORBIDDEN' });
    expect(storage.signPart).not.toHaveBeenCalled();
    await module.close();
  });
});
