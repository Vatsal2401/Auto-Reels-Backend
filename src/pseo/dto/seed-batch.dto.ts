import { IsEnum, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';
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

export class ListPseoDto {
  @IsEnum(PseoPlaybook)
  @IsOptional()
  playbook?: PseoPlaybook;

  @IsOptional()
  status?: string;

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
