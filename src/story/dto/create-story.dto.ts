import { IsString, MinLength, IsEnum, IsIn, IsOptional } from 'class-validator';
import { StoryGenre } from '../interfaces/story-script.interface';

export class CreateStoryDto {
  @IsString()
  @MinLength(10)
  prompt: string;

  @IsEnum(['horror', 'motivational', 'crime', 'urban_legend', 'comedy', 'sci_fi', 'romance', 'thriller', 'historical', 'documentary', 'mystery'])
  genre: StoryGenre;

  @IsIn([3, 5, 7, 10])
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
