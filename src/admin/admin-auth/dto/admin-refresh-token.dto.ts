import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminRefreshTokenDto {
  @ApiProperty()
  @IsString()
  refresh_token: string;
}
