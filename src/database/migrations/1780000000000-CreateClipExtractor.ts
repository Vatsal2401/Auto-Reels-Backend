import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClipExtractor1780000000000 implements MigrationInterface {
  name = 'CreateClipExtractor1780000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. clip_extract_jobs table
    await queryRunner.query(`
      CREATE TYPE "public"."clip_extract_status_enum" AS ENUM (
        'pending',
        'downloading',
        'transcribing',
        'analyzing',
        'clipping',
        'rendering',
        'completed',
        'failed',
        'rate_limited'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "clip_extract_jobs" (
        "id"                        UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"                   UUID NOT NULL,
        "source_url"                TEXT NOT NULL,
        "status"                    "public"."clip_extract_status_enum" NOT NULL DEFAULT 'pending',
        "progress_pct"              INTEGER NOT NULL DEFAULT 0,
        "current_stage"             TEXT,
        "error_message"             TEXT,
        "source_video_s3_key"       TEXT,
        "transcript_words"          JSONB,
        "source_video_duration_sec" INTEGER,
        "video_title"               TEXT,
        "options"                   JSONB NOT NULL DEFAULT '{}',
        "credits_reserved"          INTEGER NOT NULL DEFAULT 0,
        "is_premium"                BOOLEAN NOT NULL DEFAULT false,
        "created_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
        "completed_at"              TIMESTAMPTZ,
        CONSTRAINT "PK_clip_extract_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_cej_user_id" ON "clip_extract_jobs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_cej_status" ON "clip_extract_jobs" ("status")`);

    // 2. extracted_clips table
    await queryRunner.query(`
      CREATE TYPE "public"."clip_render_status_enum" AS ENUM (
        'pending',
        'rendering',
        'done',
        'failed'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "extracted_clips" (
        "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
        "job_id"                UUID NOT NULL,
        "clip_index"            INTEGER NOT NULL,
        "viral_score"           FLOAT NOT NULL,
        "hook_line"             TEXT,
        "reasoning"             TEXT,
        "tags"                  JSONB,
        "start_sec"             FLOAT NOT NULL,
        "end_sec"               FLOAT NOT NULL,
        "duration_sec"          FLOAT,
        "raw_clip_s3_key"       TEXT,
        "rendered_clip_s3_key"  TEXT,
        "thumbnail_s3_key"      TEXT,
        "word_timings"          JSONB,
        "render_status"         "public"."clip_render_status_enum" NOT NULL DEFAULT 'pending',
        "render_error"          TEXT,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extracted_clips" PRIMARY KEY ("id"),
        CONSTRAINT "FK_extracted_clips_job" FOREIGN KEY ("job_id")
          REFERENCES "clip_extract_jobs" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_ec_job_id" ON "extracted_clips" ("job_id")`);

    // 3. Add clip_extractor_enabled feature flag to user_settings
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN IF NOT EXISTS "clip_extractor_enabled" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "clip_extractor_enabled"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ec_job_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "extracted_clips"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."clip_render_status_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cej_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cej_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clip_extract_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."clip_extract_status_enum"`);
  }
}
