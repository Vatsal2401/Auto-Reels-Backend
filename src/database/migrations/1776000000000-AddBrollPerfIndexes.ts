import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrollPerfIndexes1776000000000 implements MigrationInterface {
  name = 'AddBrollPerfIndexes1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Speeds up the LATERAL JOIN in listVideos — finds latest job per video instantly
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_broll_ingest_jobs_video_created"
       ON "broll_ingestion_jobs" ("video_id", "created_at" DESC)`,
    );

    // Speeds up ownership check in listVideos EXISTS subquery
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_broll_libraries_user"
       ON "broll_libraries" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_ingest_jobs_video_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_libraries_user"`);
  }
}
