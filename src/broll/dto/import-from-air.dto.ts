import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportFromAirDto {
  @ApiProperty({ description: 'AIR board URL, e.g. https://app.air.inc/a/xxx/b/<boardId>' })
  @IsUrl()
  boardUrl: string;

  @ApiPropertyOptional({
    description: 'AIR API key for authentication (optional for public boards)',
  })
  @IsOptional()
  @IsString()
  airApiKey?: string;

  @ApiPropertyOptional({ description: 'Only import these clip IDs (omit to import all)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clipIds?: string[];

  @ApiPropertyOptional({
    description: 'Automatically trigger ingestion after upload',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoIndex?: boolean;
}
