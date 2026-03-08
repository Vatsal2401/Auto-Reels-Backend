import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class OverrideResultDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  overrideVideoId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  overrideFilename: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  overrideS3Key: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  overrideFrameTime: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overrideNote?: string;
}
