import { IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleCampaignPostDto {
  @ApiProperty({ description: 'ISO datetime when to publish', example: '2026-03-14T20:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  scheduled_at: string;
}
