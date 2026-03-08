import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportFromAirDto {
  @ApiProperty({ description: 'AIR board URL, e.g. https://app.air.inc/a/xxx/b/<boardId>' })
  @IsUrl()
  boardUrl: string;

  @ApiProperty({ description: 'AIR API key for authentication' })
  @IsNotEmpty()
  @IsString()
  airApiKey: string;

  @ApiPropertyOptional({ description: 'Automatically trigger ingestion after upload', default: false })
  @IsOptional()
  @IsBoolean()
  autoIndex?: boolean;
}
