import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';

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

  @IsOptional()
  @IsIn(['ffmpeg', 'hyperframes'])
  renderer?: string;

  @IsOptional()
  @IsIn(['cinematic', 'bold', 'minimal', 'neon'])
  hyperframesTemplate?: string;
}
