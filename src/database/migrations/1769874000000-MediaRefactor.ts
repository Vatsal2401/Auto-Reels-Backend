import { MigrationInterface, QueryRunner } from 'typeorm';

export class MediaRefactor1769874000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create MediaType and MediaStatus enums if they don't exist as types (Postgres)
        await queryRunner.query(`
      CREATE TYPE "media_type_enum" AS ENUM('image', 'video', 'avatar', 'audio');
      CREATE TYPE "media_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed');
      CREATE TYPE "step_status_enum" AS ENUM('pending', 'processing', 'success', 'failed');
      CREATE TYPE "media_asset_type_enum" AS ENUM('script', 'audio', 'image', 'caption', 'video', 'avatar');
    `);

        // 2. Create media table
        await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "media_type_enum" NOT NULL,
        "flow_key" text NOT NULL,
        "status" "media_status_enum" NOT NULL DEFAULT 'pending',
        "user_id" uuid,
        "input_config" jsonb,
        "blob_storage_id" text,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        CONSTRAINT "PK_media_id" PRIMARY KEY ("id")
      )
    `);

        // 3. Create media_steps table
        await queryRunner.query(`
      CREATE TABLE "media_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "media_id" uuid NOT NULL,
        "step" text NOT NULL,
        "status" "step_status_enum" NOT NULL DEFAULT 'pending',
        "depends_on" jsonb,
        "blob_storage_id" jsonb,
        "retry_count" int NOT NULL DEFAULT 0,
        "error_message" text,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_steps_id" PRIMARY KEY ("id")
      )
    `);

        // 4. Create media_assets table
        await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "media_id" uuid NOT NULL,
        "type" "media_asset_type_enum" NOT NULL,
        "blob_storage_id" text NOT NULL,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_assets_id" PRIMARY KEY ("id")
      )
    `);

        // 5. Add Foreign Key constraints
        await queryRunner.query(`
      ALTER TABLE "media_steps" ADD CONSTRAINT "FK_media_steps_media" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;
      ALTER TABLE "media_assets" ADD CONSTRAINT "FK_media_assets_media" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE;
      ALTER TABLE "media" ADD CONSTRAINT "FK_media_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

        // 6. Migrate data from videos to media
        // Note: This assumes existing videos were of type 'video' and flow 'videoMotion'
        await queryRunner.query(`
      INSERT INTO "media" ("id", "type", "flow_key", "status", "user_id", "input_config", "blob_storage_id", "error_message", "created_at", "updated_at", "completed_at")
      SELECT 
        "id", 
        'video'::media_type_enum, 
        'videoMotion', 
        "status"::text::media_status_enum, 
        "user_id",
        jsonb_build_object(
          'topic', "topic",
          'script', "script",
          'script_json', "script_json",
          'metadata', "metadata"
        ),
        COALESCE("final_video_url", "generated_video_url"),
        "error_message",
        "created_at",
        "updated_at",
        "completed_at"
      FROM "videos";
    `);

        // 7. Migrate data from jobs to media_steps
        await queryRunner.query(`
      INSERT INTO "media_steps" ("media_id", "step", "status", "retry_count", "error_message", "started_at", "completed_at", "created_at", "updated_at")
      SELECT 
        "video_id", 
        "job_type"::text, 
        CASE 
          WHEN "status" = 'completed' THEN 'success'::step_status_enum
          ELSE "status"::text::step_status_enum
        END,
        "retry_count",
        "error_message",
        NULL, -- started_at not in old table
        "completed_at",
        "created_at",
        "updated_at"
      FROM "jobs";
    `);

        // 8. Migrate data from assets to media_assets
        await queryRunner.query(`
      INSERT INTO "media_assets" ("media_id", "type", "blob_storage_id", "metadata", "created_at")
      SELECT 
        "video_id", 
        "asset_type"::text::media_asset_type_enum, 
        "s3_url", -- Storing URL as ID for old data compatibility
        "metadata",
        "created_at"
      FROM "assets";
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new tables and types
        await queryRunner.query('DROP TABLE "media_assets"');
        await queryRunner.query('DROP TABLE "media_steps"');
        await queryRunner.query('DROP TABLE "media"');
        await queryRunner.query('DROP TYPE "media_asset_type_enum"');
        await queryRunner.query('DROP TYPE "step_status_enum"');
        await queryRunner.query('DROP TYPE "media_status_enum"');
        await queryRunner.query('DROP TYPE "media_type_enum"');
    }
}
