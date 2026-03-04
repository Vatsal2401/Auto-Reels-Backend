import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class LipSyncDto {
  @IsOptional()
  @IsInt()
  @Min(-20)
  @Max(20)
  bbox_shift?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(30)
  fps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  batch_size?: number;
}
