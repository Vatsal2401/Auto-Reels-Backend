import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUploadLogs1771700000000 implements MigrationInterface {
  name = 'CreateUploadLogs1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "upload_logs_event_enum" AS ENUM (
        'queued', 'token_refreshed', 'token_refresh_failed',
        'upload_started', 'upload_progress', 'upload_complete',
        'publish_success', 'publish_failed', 'cancelled',
        'quota_exceeded', 'rescheduled'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "upload_logs" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scheduled_post_id" uuid NOT NULL,
        "event"             "upload_logs_event_enum" NOT NULL,
        "metadata"          jsonb,
        "attempt_number"    int NOT NULL DEFAULT 1,
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_upload_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_upload_logs_scheduled_post"
          FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_upload_logs_post_created"
        ON "upload_logs" ("scheduled_post_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "upload_logs"`);
    await queryRunner.query(`DROP TYPE "upload_logs_event_enum"`);
  }
}
