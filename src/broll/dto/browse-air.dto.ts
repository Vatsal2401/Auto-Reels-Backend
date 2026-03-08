import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BrowseAirDto {
  @ApiProperty({ example: 'https://app.air.inc/a/workspace/b/...' })
  @IsString()
  @IsNotEmpty()
  boardUrl: string;
}
