import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminImpersonationLogsTable1771000000001 implements MigrationInterface {
  name = 'CreateAdminImpersonationLogsTable1771000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_impersonation_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "ip_address" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_impersonation_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_impersonation_logs_admin_id" ON "admin_impersonation_logs" ("admin_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_impersonation_logs_user_id" ON "admin_impersonation_logs" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_impersonation_logs_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_admin_impersonation_logs_admin_id"`);
    await queryRunner.query(`DROP TABLE "admin_impersonation_logs"`);
  }
}
