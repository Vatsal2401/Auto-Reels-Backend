import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MatchScriptDto {
  @ApiProperty({ type: [String], description: 'Script lines to match against B-roll library' })
  @IsArray()
  @IsString({ each: true })
  scriptLines: string[];

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dedupConsecutive?: boolean;
}
