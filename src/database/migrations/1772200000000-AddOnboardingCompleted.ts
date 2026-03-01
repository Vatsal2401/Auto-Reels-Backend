import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingCompleted1772200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "has_completed_onboarding"`,
    );
  }
}
