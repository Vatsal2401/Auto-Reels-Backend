import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic: string;
}
