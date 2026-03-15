import { IsOptional, IsInt, Min, IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PostingTimeSlotDto {
  @IsInt() @Min(0) weekday: number; // 0=Sun..6=Sat (JS Date.getDay())
  @IsInt() @Min(0) hour: number; // 0–23
  @IsInt() @Min(0) minute: number; // 0–59
}

export class UpdatePublishingSettingsDto {
  @ApiPropertyOptional({ description: 'Warn if exceeded (must be < hard_daily_posts)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  soft_daily_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  soft_weekly_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  soft_monthly_posts?: number;

  @ApiPropertyOptional({ description: 'Block scheduling if exceeded' })
  @IsOptional()
  @IsInt()
  @Min(1)
  hard_daily_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  hard_weekly_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  hard_monthly_posts?: number;

  @ApiPropertyOptional({ type: [PostingTimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostingTimeSlotDto)
  preferred_posting_times?: PostingTimeSlotDto[];

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Hours between posts for this account' })
  @IsOptional()
  @IsInt()
  @Min(0)
  min_hours_between_posts?: number;
}
