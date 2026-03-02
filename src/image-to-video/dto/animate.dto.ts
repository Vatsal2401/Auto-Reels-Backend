import { IsOptional, IsInt, IsNumber, Min, Max } from 'class-validator';

export class AnimateDto {
  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(25)
  num_frames?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  num_inference_steps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  fps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(255)
  motion_bucket_id?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  noise_aug_strength?: number;

  @IsOptional()
  @IsInt()
  seed?: number;
}
