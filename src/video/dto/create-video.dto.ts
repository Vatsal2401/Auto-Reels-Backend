import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic: string;

  @IsString()
  language: string;

  @IsString()
  duration: string;

  @IsString()
  imageStyle: string;

  @IsString()
  imageAspectRatio: string;

  @IsString()
  voiceId: string;

  @IsString()
  imageProvider: string;

  @IsString()
  captions: any;

  @IsString()
  music: any;
}
