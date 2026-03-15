import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrollMatcher1773000000000 implements MigrationInterface {
  name = 'CreateBrollMatcher1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(
      `CREATE TABLE "broll_videos" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "file_path"        TEXT NOT NULL UNIQUE,
        "filename"         TEXT NOT NULL,
        "duration_seconds" FLOAT,
        "width"            INTEGER,
        "height"           INTEGER,
        "fps"              FLOAT,
        "frame_count"      INTEGER NOT NULL DEFAULT 0,
        "ingested_at"      TIMESTAMP,
        "status"           VARCHAR(20) NOT NULL DEFAULT 'pending',
        "error_message"    TEXT,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "broll_frame_embeddings" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "video_id"    uuid NOT NULL REFERENCES "broll_videos"("id") ON DELETE CASCADE,
        "frame_time"  FLOAT NOT NULL,
        "frame_index" INTEGER NOT NULL,
        "embedding"   vector(768) NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_broll_frame_video_id" ON "broll_frame_embeddings" ("video_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_broll_videos_status" ON "broll_videos" ("status")`);

    // IVFFlat index intentionally omitted here — run POST /admin/broll/rebuild-index
    // after first ingestion so the quantizer has data to train on.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_videos_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_frame_video_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_embedding_ivfflat"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_frame_embeddings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_videos"`);
  }
}
