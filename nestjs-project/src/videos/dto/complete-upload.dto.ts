import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class UploadPartDto {
  @IsInt() @Min(1) @Max(640) part_number: number;
  @IsString() @MaxLength(128) etag: string;
}
export class CompleteUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(640)
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts: UploadPartDto[];
}
