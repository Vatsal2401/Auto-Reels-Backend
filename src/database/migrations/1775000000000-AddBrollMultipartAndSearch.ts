import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrollMultipartAndSearch1775000000000 implements MigrationInterface {
  name = 'AddBrollMultipartAndSearch1775000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add file size + content type to broll_videos
    await queryRunner.query(`
      ALTER TABLE "broll_videos"
        ADD COLUMN IF NOT EXISTS "file_size_bytes" BIGINT,
        ADD COLUMN IF NOT EXISTS "content_type"    TEXT
    `);

    // Track S3 multipart uploads so we can abort orphaned ones
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "broll_multipart_uploads" (
        "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "video_id"    uuid        NOT NULL REFERENCES "broll_videos"("id") ON DELETE CASCADE,
        "library_id"  uuid        NOT NULL REFERENCES "broll_libraries"("id") ON DELETE CASCADE,
        "upload_id"   TEXT        NOT NULL,
        "s3_key"      TEXT        NOT NULL,
        "filename"    TEXT        NOT NULL,
        "total_parts" INT,
        "status"      VARCHAR(20) NOT NULL DEFAULT 'active',
        "created_at"  TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP   NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_broll_multipart_video"
        ON "broll_multipart_uploads"("video_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_broll_multipart_library"
        ON "broll_multipart_uploads"("library_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_broll_multipart_status"
        ON "broll_multipart_uploads"("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_multipart_uploads"`);
    await queryRunner.query(`ALTER TABLE "broll_videos" DROP COLUMN IF EXISTS "file_size_bytes"`);
    await queryRunner.query(`ALTER TABLE "broll_videos" DROP COLUMN IF EXISTS "content_type"`);
  }
}
