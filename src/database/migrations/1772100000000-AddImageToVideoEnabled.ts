import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageToVideoEnabled1772100000000 implements MigrationInterface {
  name = 'AddImageToVideoEnabled1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN "image_to_video_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      DROP COLUMN "image_to_video_enabled"
    `);
  }
}
