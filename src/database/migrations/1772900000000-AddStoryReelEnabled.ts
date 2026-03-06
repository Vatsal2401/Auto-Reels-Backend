import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryReelEnabled1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings"
      ADD COLUMN IF NOT EXISTS "story_reel_enabled" BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "story_reel_enabled"
    `);
  }
}
