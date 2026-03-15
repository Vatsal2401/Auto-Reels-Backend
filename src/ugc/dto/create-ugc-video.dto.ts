import { IsString, IsArray, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreateUgcVideoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  productName: string;

  @IsString()
  @MinLength(20)
  @MaxLength(600)
  productDescription: string;

  @IsArray()
  @IsOptional()
  benefits?: string[];

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  targetAudience: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  callToAction: string;

  @IsUUID()
  actorId: string;

  @IsString()
  ugcStyle: 'selfie_review' | 'unboxing' | 'problem_solution' | 'before_after' | 'tiktok_story';

  /** ElevenLabs voice ID (falls back to actor.voice_id if not provided) */
  @IsString()
  @IsOptional()
  voiceId?: string;

  /** Optional music track ID from background_music table */
  @IsString()
  @IsOptional()
  musicId?: string;

  /** Optional product image S3 keys uploaded by user */
  @IsArray()
  @IsOptional()
  productImageKeys?: string[];
}
