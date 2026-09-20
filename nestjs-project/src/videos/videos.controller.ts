import { Throttle } from '@nestjs/throttler';
import { videoUserTracker } from './video-throttle';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Redirect,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { StartUploadDto } from './dto/start-upload.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { VideosService } from './videos.service';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}
  @Post('uploads')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start a direct multipart upload' })
  @ApiResponse({ status: 201, description: 'Draft created' })
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartUploadDto) {
    return this.videos.start(user.sub, dto);
  }
  @Throttle({
    default: { limit: 720, ttl: 60000, getTracker: videoUserTracker },
  })
  @Post(':id/upload-parts/:partNumber')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign an upload part' })
  part(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partNumber', ParseIntPipe) part: number,
  ) {
    return this.videos.signPart(user.sub, id, part);
  }
  @Post(':id/complete')
  @HttpCode(202)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Complete upload and schedule processing' })
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.videos.complete(user.sub, id, dto);
  }
  @Delete(':id/upload')
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel a draft upload' })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.videos.cancel(user.sub, id);
  }
  @Throttle({
    default: { limit: 120, ttl: 60000, getTracker: videoUserTracker },
  })
  @Get(':id/status')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get owner processing status' })
  status(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.videos.status(user.sub, id);
  }
  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a ready video' })
  get(@Param('slug', ParseUUIDPipe) slug: string) {
    return this.videos.get(slug);
  }
  @Public()
  @Get(':slug/stream')
  @Redirect()
  @ApiOperation({ summary: 'Redirect to Range-capable private media' })
  stream(@Param('slug', ParseUUIDPipe) slug: string) {
    return this.videos.media(slug, 'stream');
  }
  @Public()
  @Get(':slug/download')
  @Redirect()
  @ApiOperation({ summary: 'Download original video' })
  download(@Param('slug', ParseUUIDPipe) slug: string) {
    return this.videos.media(slug, 'download');
  }
  @Public()
  @Get(':slug/thumbnail')
  @Redirect()
  @ApiOperation({ summary: 'Get generated thumbnail' })
  thumbnail(@Param('slug', ParseUUIDPipe) slug: string) {
    return this.videos.media(slug, 'thumbnail');
  }
}
