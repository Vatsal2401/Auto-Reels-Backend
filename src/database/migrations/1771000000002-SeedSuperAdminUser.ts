import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedSuperAdminUser1771000000002 implements MigrationInterface {
  name = 'SeedSuperAdminUser1771000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;

    if (!email || !password) {
      console.warn(
        '[SeedSuperAdminUser] ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD not set — skipping seed.',
      );
      return;
    }

    const existing = await queryRunner.query(`SELECT id FROM admin_users WHERE email = $1`, [
      email,
    ]);

    if (existing.length > 0) {
      console.log(`[SeedSuperAdminUser] Admin with email ${email} already exists — skipping.`);
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    await queryRunner.query(
      `INSERT INTO admin_users (id, email, password, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'super_admin', now(), now())`,
      [email, hash],
    );

    console.log(`[SeedSuperAdminUser] Super admin seeded: ${email}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_SEED_EMAIL;
    if (email) {
      await queryRunner.query(`DELETE FROM admin_users WHERE email = $1 AND role = 'super_admin'`, [
        email,
      ]);
    }
  }
}
