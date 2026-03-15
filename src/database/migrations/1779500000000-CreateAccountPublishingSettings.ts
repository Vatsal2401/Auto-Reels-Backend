import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountPublishingSettings1779500000000 implements MigrationInterface {
  name = 'CreateAccountPublishingSettings1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "account_publishing_settings" (
        "id"                      uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "connected_account_id"    uuid        NOT NULL,
        "soft_daily_posts"        smallint    NOT NULL DEFAULT 3,
        "soft_weekly_posts"       smallint    NOT NULL DEFAULT 10,
        "soft_monthly_posts"      smallint    NOT NULL DEFAULT 35,
        "hard_daily_posts"        smallint    NOT NULL DEFAULT 5,
        "hard_weekly_posts"       smallint    NOT NULL DEFAULT 20,
        "hard_monthly_posts"      smallint    NOT NULL DEFAULT 60,
        "preferred_posting_times" jsonb       NOT NULL DEFAULT '[]',
        "timezone"                varchar(60) NOT NULL DEFAULT 'UTC',
        "min_hours_between_posts" smallint    NOT NULL DEFAULT 4,
        "platform_overrides"      jsonb       NOT NULL DEFAULT '{}',
        "created_at"              TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_publishing_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_publishing_settings_account"
          UNIQUE ("connected_account_id"),
        CONSTRAINT "FK_account_publishing_settings_account"
          FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_aps_soft_daily_positive"    CHECK ("soft_daily_posts"   > 0),
        CONSTRAINT "CHK_aps_soft_weekly_positive"   CHECK ("soft_weekly_posts"  > 0),
        CONSTRAINT "CHK_aps_soft_monthly_positive"  CHECK ("soft_monthly_posts" > 0),
        CONSTRAINT "CHK_aps_hard_daily_positive"    CHECK ("hard_daily_posts"   > 0),
        CONSTRAINT "CHK_aps_hard_weekly_positive"   CHECK ("hard_weekly_posts"  > 0),
        CONSTRAINT "CHK_aps_hard_monthly_positive"  CHECK ("hard_monthly_posts" > 0),
        CONSTRAINT "CHK_aps_daily_limit_order"
          CHECK ("soft_daily_posts"   < "hard_daily_posts"),
        CONSTRAINT "CHK_aps_weekly_limit_order"
          CHECK ("soft_weekly_posts"  < "hard_weekly_posts"),
        CONSTRAINT "CHK_aps_monthly_limit_order"
          CHECK ("soft_monthly_posts" < "hard_monthly_posts"),
        CONSTRAINT "CHK_aps_min_hours"
          CHECK ("min_hours_between_posts" >= 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "account_publishing_settings"`);
  }
}
