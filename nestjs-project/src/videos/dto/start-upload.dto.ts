import {
  IsIn,
  IsInt,
  IsNotEmpty,
  Matches,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_VIDEO_BYTES } from '../video.constants';
export class StartUploadDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(200) title: string;
  @IsInt() @Min(1) @Max(MAX_VIDEO_BYTES) size_bytes: number;
  @IsIn(['video/mp4', 'video/webm', 'video/quicktime']) content_type: string;
}
