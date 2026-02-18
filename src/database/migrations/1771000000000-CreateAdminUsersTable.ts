import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminUsersTable1771000000000 implements MigrationInterface {
  name = 'CreateAdminUsersTable1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."admin_users_role_enum" AS ENUM('super_admin', 'admin')`,
    );

    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "public"."admin_users_role_enum" NOT NULL DEFAULT 'admin',
        "refresh_token" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_users"`);
    await queryRunner.query(`DROP TYPE "public"."admin_users_role_enum"`);
  }
}
