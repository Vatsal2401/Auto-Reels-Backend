import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrollProductSchema1774000000000 implements MigrationInterface {
  name = 'AddBrollProductSchema1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Feature flag on user_settings
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "broll_enabled" BOOLEAN NOT NULL DEFAULT false`,
    );

    // B-roll libraries (top-level container)
    await queryRunner.query(`
      CREATE TABLE "broll_libraries" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"       uuid NOT NULL,
        "name"          VARCHAR(255) NOT NULL,
        "description"   TEXT,
        "status"        VARCHAR(20) NOT NULL DEFAULT 'draft',
        "video_count"   INT NOT NULL DEFAULT 0,
        "indexed_count" INT NOT NULL DEFAULT 0,
        "scene_count"   INT NOT NULL DEFAULT 0,
        "script_count"  INT NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Link broll_videos to a library
    await queryRunner.query(
      `ALTER TABLE "broll_videos" ADD COLUMN IF NOT EXISTS "library_id" uuid REFERENCES "broll_libraries"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(`ALTER TABLE "broll_videos" ADD COLUMN IF NOT EXISTS "user_id" uuid`);

    // B-roll scripts
    await queryRunner.query(`
      CREATE TABLE "broll_scripts" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id"    uuid NOT NULL REFERENCES "broll_libraries"("id") ON DELETE CASCADE,
        "user_id"       uuid NOT NULL,
        "name"          VARCHAR(255) NOT NULL DEFAULT 'Untitled Script',
        "script_text"   TEXT NOT NULL DEFAULT '',
        "version"       INT NOT NULL DEFAULT 1,
        "status"        VARCHAR(20) NOT NULL DEFAULT 'draft',
        "total_lines"   INT NOT NULL DEFAULT 0,
        "matched_lines" INT NOT NULL DEFAULT 0,
        "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Per-line match results
    await queryRunner.query(`
      CREATE TABLE "broll_match_results" (
        "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "script_id"           uuid NOT NULL REFERENCES "broll_scripts"("id") ON DELETE CASCADE,
        "line_index"          INT NOT NULL,
        "script_line"         TEXT NOT NULL,
        "primary_video_id"    uuid REFERENCES "broll_videos"("id"),
        "primary_filename"    TEXT,
        "primary_s3_key"      TEXT,
        "primary_frame_time"  FLOAT,
        "primary_score"       FLOAT,
        "alt_video_id"        uuid REFERENCES "broll_videos"("id"),
        "alt_filename"        TEXT,
        "alt_frame_time"      FLOAT,
        "alt_score"           FLOAT,
        "override_video_id"   uuid REFERENCES "broll_videos"("id"),
        "override_filename"   TEXT,
        "override_s3_key"     TEXT,
        "override_frame_time" FLOAT,
        "override_note"       TEXT,
        "is_locked"           BOOLEAN NOT NULL DEFAULT false,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Per-video ingestion jobs
    await queryRunner.query(`
      CREATE TABLE "broll_ingestion_jobs" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "video_id"         uuid NOT NULL REFERENCES "broll_videos"("id") ON DELETE CASCADE,
        "library_id"       uuid NOT NULL REFERENCES "broll_libraries"("id") ON DELETE CASCADE,
        "status"           VARCHAR(20) NOT NULL DEFAULT 'queued',
        "stage"            VARCHAR(50),
        "frames_processed" INT NOT NULL DEFAULT 0,
        "total_frames"     INT,
        "error_message"    TEXT,
        "attempts"         INT NOT NULL DEFAULT 0,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "idx_broll_libraries_user" ON "broll_libraries"("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_broll_videos_library" ON "broll_videos"("library_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_broll_scripts_library" ON "broll_scripts"("library_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_broll_results_script" ON "broll_match_results"("script_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_broll_ingest_jobs_library" ON "broll_ingestion_jobs"("library_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_broll_ingest_jobs_status" ON "broll_ingestion_jobs"("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_ingest_jobs_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_ingest_jobs_library"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_results_script"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_scripts_library"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_videos_library"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_libraries_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_ingestion_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_match_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_scripts"`);
    await queryRunner.query(`ALTER TABLE "broll_videos" DROP COLUMN IF EXISTS "user_id"`);
    await queryRunner.query(`ALTER TABLE "broll_videos" DROP COLUMN IF EXISTS "library_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_libraries"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "broll_enabled"`);
  }
}
