import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCreditsDto {
  @ApiProperty({ description: 'Delta to add (positive) or subtract (negative)', example: 10 })
  @IsInt()
  @IsNotEmpty()
  credits: number;
}
