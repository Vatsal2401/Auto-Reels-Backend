import { IsEnum, IsBoolean, IsOptional, IsInt, Min, Max, IsString, IsArray } from 'class-validator';
import { PseoPlaybook } from '../entities/pseo-page.entity';

export class SeedPlaybookDto {
  @IsEnum(PseoPlaybook)
  playbook: PseoPlaybook;

  @IsBoolean()
  @IsOptional()
  overwrite?: boolean;
}

export class GeneratePlaybookDto {
  @IsEnum(PseoPlaybook)
  playbook: PseoPlaybook;

  @IsInt()
  @Min(1)
  @Max(10000)
  limit: number;

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  concurrency?: number;
}

export class PublishBatchDto {
  @IsEnum(PseoPlaybook)
  @IsOptional()
  playbook?: PseoPlaybook;

  @IsInt()
  @Min(0)
  @Max(100)
  minScore: number;
}

export class ComputeLinksDto {
  @IsEnum(PseoPlaybook)
  @IsOptional()
  playbook?: PseoPlaybook;
}

export class UpdateContentDto {
  content: Record<string, any>;
}

export class UpdateMetadataDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  meta_description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];
}

export class UpdateDimensionDto {
  @IsArray()
  @IsString({ each: true })
  values: string[];
}

export class AddDimensionValueDto {
  @IsString()
  value: string;
}

export class UpdatePlaybookConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  min_quality_score?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  min_word_count?: number;
}

export class ListPseoDto {
  @IsEnum(PseoPlaybook)
  @IsOptional()
  playbook?: PseoPlaybook;

  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}
