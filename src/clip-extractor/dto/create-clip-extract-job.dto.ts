import { IsUrl, IsOptional, IsInt, Min, Max, IsBoolean, IsUUID, IsEnum, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CaptionStyle } from '../entities/clip-extract-job.entity';

export class CreateClipExtractJobDto {
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  sourceUrl: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxClips?: number;

  @ApiPropertyOptional({ default: 30, minimum: 15 })
  @IsOptional()
  @IsInt()
  @Min(15)
  minClipSec?: number;

  @ApiPropertyOptional({ default: 90, maximum: 180 })
  @IsOptional()
  @IsInt()
  @Max(180)
  maxClipSec?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  removeSilence?: boolean;

  @ApiPropertyOptional({
    default: 'bold',
    enum: ['bold', 'minimal', 'neon', 'classic'],
  })
  @IsOptional()
  @IsEnum(['bold', 'minimal', 'neon', 'classic'])
  captionStyle?: CaptionStyle;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  splitScreenBroll?: boolean;

  @ApiPropertyOptional({ description: 'B-roll library UUID for split-screen overlay' })
  @IsOptional()
  @IsUUID()
  brollLibraryId?: string;

  @ApiPropertyOptional({ enum: ['portrait_9x16', 'original'], default: 'portrait_9x16' })
  @IsOptional()
  @IsIn(['portrait_9x16', 'original'])
  outputFormat?: 'portrait_9x16' | 'original';
}
