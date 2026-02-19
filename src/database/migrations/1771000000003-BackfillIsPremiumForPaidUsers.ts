import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillIsPremiumForPaidUsers1771000000003 implements MigrationInterface {
  name = 'BackfillIsPremiumForPaidUsers1771000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET is_premium = true
      WHERE id IN (
        SELECT DISTINCT user_id FROM payments WHERE status = 'paid'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot safely reverse — would need to know which users were premium before
  }
}
