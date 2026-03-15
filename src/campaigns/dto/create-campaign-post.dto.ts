import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignPostType, ContentSource } from '../entities/campaign-post.entity';

export class CreateCampaignPostDto {
  @ApiProperty({ minimum: 1, description: 'Day in campaign calendar (Day 1, Day 2...)' })
  @IsInt()
  @Min(1)
  day_number: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiProperty({ enum: CampaignPostType })
  @IsEnum(CampaignPostType)
  post_type: CampaignPostType;

  @ApiPropertyOptional({ enum: ContentSource, default: ContentSource.NEW })
  @IsOptional()
  @IsEnum(ContentSource)
  content_source?: ContentSource;

  @ApiPropertyOptional({ example: 'media', description: 'Required when content_source=existing' })
  @IsOptional()
  @IsString()
  source_entity_type?: string;

  @ApiPropertyOptional({ description: 'Required when content_source=existing' })
  @IsOptional()
  @IsUUID()
  source_entity_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hook?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  script?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hashtags?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  target_platforms?: string[];
}
