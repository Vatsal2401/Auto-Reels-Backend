import { IsString, MinLength, IsEnum, IsIn, IsOptional } from 'class-validator';
import { StoryGenre } from '../interfaces/story-script.interface';

export class CreateStoryDto {
  @IsString()
  @MinLength(10)
  prompt: string;

  @IsEnum(['horror', 'motivational', 'crime', 'urban_legend', 'comedy'])
  genre: StoryGenre;

  @IsIn([3, 5, 7])
  sceneCount: number;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  voiceLabel?: string;

  @IsOptional()
  @IsString()
  musicId?: string;

  @IsOptional()
  @IsString()
  imageStyle?: string;
}
