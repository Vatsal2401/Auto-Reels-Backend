import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSettings1771800000000 implements MigrationInterface {
  name = 'CreateUserSettings1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "user_id"                        uuid NOT NULL,
        "social_media_scheduler_enabled" boolean NOT NULL DEFAULT false,
        "updated_at"                     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_settings" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_user_settings_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_settings"`);
  }
}
