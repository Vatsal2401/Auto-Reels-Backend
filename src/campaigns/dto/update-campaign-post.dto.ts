import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCampaignPostDto } from './create-campaign-post.dto';

export class UpdateCampaignPostDto extends PartialType(CreateCampaignPostDto) {
  @ApiPropertyOptional({ description: 'ISO datetime for scheduling' })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;
}
