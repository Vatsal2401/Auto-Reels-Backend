import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConnectedAccounts1771500000000 implements MigrationInterface {
  name = 'CreateConnectedAccounts1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "connected_accounts_platform_enum" AS ENUM ('youtube', 'tiktok', 'instagram')
    `);

    await queryRunner.query(`
      CREATE TABLE "connected_accounts" (
        "id"                  uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"             uuid NOT NULL,
        "platform"            "connected_accounts_platform_enum" NOT NULL,
        "platform_account_id" text NOT NULL,
        "account_name"        text,
        "account_avatar_url"  text,
        "access_token_enc"    text NOT NULL,
        "refresh_token_enc"   text,
        "token_expires_at"    TIMESTAMPTZ,
        "token_type"          text,
        "scopes"              text,
        "is_active"           boolean NOT NULL DEFAULT true,
        "needs_reauth"        boolean NOT NULL DEFAULT false,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_connected_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_connected_accounts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_connected_accounts_user_platform_account"
        ON "connected_accounts" ("user_id", "platform", "platform_account_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "connected_accounts"`);
    await queryRunner.query(`DROP TYPE "connected_accounts_platform_enum"`);
  }
}
