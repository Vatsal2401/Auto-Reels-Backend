import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillOnboardingCompleted1772300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mark all existing user_settings rows as onboarding completed
    await queryRunner.query(
      `UPDATE "user_settings" SET "has_completed_onboarding" = true`,
    );

    // Insert user_settings rows for existing users who don't have one yet,
    // marking them as onboarding completed
    await queryRunner.query(`
      INSERT INTO "user_settings" ("user_id", "has_completed_onboarding")
      SELECT u.id, true
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_settings" s WHERE s.user_id = u.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all rows back to false (cannot distinguish new vs old users after rollback)
    await queryRunner.query(
      `UPDATE "user_settings" SET "has_completed_onboarding" = false`,
    );
  }
}
