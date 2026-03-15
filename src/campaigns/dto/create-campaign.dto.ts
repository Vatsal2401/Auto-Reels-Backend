import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignGoalType } from '../entities/campaign.entity';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Motivation Growth Campaign' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: CampaignGoalType })
  @IsEnum(CampaignGoalType)
  goal_type: CampaignGoalType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal_description?: string;

  @ApiPropertyOptional({ example: 'cinematic' })
  @IsOptional()
  @IsString()
  visual_style?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  icp_criteria?: Record<string, any>;

  @ApiPropertyOptional({ example: '2026-03-10' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  posting_cadence_days?: number;

  @ApiPropertyOptional({ type: [String], example: ['instagram', 'tiktok'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  target_platforms?: string[];
}
