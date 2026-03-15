import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class IngestDto {
  @ApiPropertyOptional({
    default: '/broll',
    description: 'Absolute path to B-roll video directory on the Python service',
  })
  @IsOptional()
  @IsString()
  videoDir?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  forceReingest?: boolean;
}
