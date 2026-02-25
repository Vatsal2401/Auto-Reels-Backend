import { IsString, IsUUID, IsDateString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialPlatform } from '../entities/connected-account.entity';

export class SchedulePostDto {
  @ApiProperty({ example: 'youtube', enum: SocialPlatform })
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @ApiProperty({ description: 'Connected account UUID' })
  @IsUUID()
  connectedAccountId: string;

  @ApiProperty({ description: 'S3 key of the video file' })
  @IsString()
  videoS3Key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoTopic?: string;

  @ApiProperty({ description: 'ISO 8601 datetime for when to publish' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({
    description: 'Platform-specific publish options (title, description, tags, etc.)',
  })
  @IsOptional()
  @IsObject()
  publishOptions?: Record<string, any>;
}
