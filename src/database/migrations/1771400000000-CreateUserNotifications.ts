import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserNotifications1771400000000 implements MigrationInterface {
  name = 'CreateUserNotifications1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_notifications_type_enum" AS ENUM('video_completed', 'video_failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."user_notifications_type_enum" NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "video_id" text,
        "action_href" text,
        "read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_notifications_user_created" ON "user_notifications" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_notifications_unread" ON "user_notifications" ("user_id", "read") WHERE read = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_notifications_unread"`);
    await queryRunner.query(`DROP INDEX "idx_user_notifications_user_created"`);
    await queryRunner.query(`DROP TABLE "user_notifications"`);
    await queryRunner.query(`DROP TYPE "public"."user_notifications_type_enum"`);
  }
}
