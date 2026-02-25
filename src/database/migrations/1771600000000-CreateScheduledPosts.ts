import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScheduledPosts1771600000000 implements MigrationInterface {
  name = 'CreateScheduledPosts1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "scheduled_posts_status_enum"   AS ENUM ('pending', 'uploading', 'success', 'failed', 'cancelled');
      CREATE TYPE "scheduled_posts_platform_enum" AS ENUM ('youtube', 'tiktok', 'instagram');
    `);

    await queryRunner.query(`
      CREATE TABLE "scheduled_posts" (
        "id"                   uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"              uuid NOT NULL,
        "connected_account_id" uuid NOT NULL,
        "platform"             "scheduled_posts_platform_enum" NOT NULL,
        "video_s3_key"         text NOT NULL,
        "video_topic"          text,
        "scheduled_at"         TIMESTAMPTZ NOT NULL,
        "status"               "scheduled_posts_status_enum" NOT NULL DEFAULT 'pending',
        "platform_post_id"     text,
        "publish_options"      jsonb,
        "error_message"        text,
        "upload_progress_pct"  int NOT NULL DEFAULT 0,
        "created_at"           TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scheduled_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_scheduled_posts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_scheduled_posts_account"
          FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_scheduled_posts_user_scheduled_at"
        ON "scheduled_posts" ("user_id", "scheduled_at");
      CREATE INDEX "IDX_scheduled_posts_status_scheduled_at"
        ON "scheduled_posts" ("status", "scheduled_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "scheduled_posts"`);
    await queryRunner.query(`DROP TYPE "scheduled_posts_status_enum"`);
    await queryRunner.query(`DROP TYPE "scheduled_posts_platform_enum"`);
  }
}
