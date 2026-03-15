import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCampaignAccountDto {
  @ApiProperty({ description: 'ID of the connected_account to add' })
  @IsNotEmpty()
  @IsUUID()
  connected_account_id: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Override global soft daily limit for this campaign' })
  @IsOptional()
  @IsInt()
  @Min(1)
  override_soft_daily_posts?: number;

  @ApiPropertyOptional({ description: 'Override global hard daily limit for this campaign' })
  @IsOptional()
  @IsInt()
  @Min(1)
  override_hard_daily_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  override_soft_weekly_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  override_hard_weekly_posts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
