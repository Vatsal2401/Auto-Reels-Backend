import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignAccounts1779400000000 implements MigrationInterface {
  name = 'CreateCampaignAccounts1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "campaign_accounts" (
        "id"                          uuid     NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id"                 uuid     NOT NULL,
        "connected_account_id"        uuid     NOT NULL,
        "is_active"                   boolean  NOT NULL DEFAULT true,
        "priority"                    smallint NOT NULL DEFAULT 5,
        "override_soft_daily_posts"   smallint,
        "override_hard_daily_posts"   smallint,
        "override_soft_weekly_posts"  smallint,
        "override_hard_weekly_posts"  smallint,
        "notes"                       text,
        "added_at"                    TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"                  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_campaign_accounts_campaign_account"
          UNIQUE ("campaign_id", "connected_account_id"),
        CONSTRAINT "FK_campaign_accounts_campaign"
          FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_campaign_accounts_connected_account"
          FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_campaign_accounts_priority"
          CHECK ("priority" BETWEEN 1 AND 10),
        CONSTRAINT "CHK_campaign_accounts_soft_daily_positive"
          CHECK ("override_soft_daily_posts" IS NULL OR "override_soft_daily_posts" > 0),
        CONSTRAINT "CHK_campaign_accounts_hard_daily_positive"
          CHECK ("override_hard_daily_posts" IS NULL OR "override_hard_daily_posts" > 0),
        CONSTRAINT "CHK_campaign_accounts_daily_limit_order"
          CHECK (
            "override_soft_daily_posts" IS NULL OR
            "override_hard_daily_posts" IS NULL OR
            "override_soft_daily_posts" < "override_hard_daily_posts"
          ),
        CONSTRAINT "CHK_campaign_accounts_weekly_limit_order"
          CHECK (
            "override_soft_weekly_posts" IS NULL OR
            "override_hard_weekly_posts" IS NULL OR
            "override_soft_weekly_posts" < "override_hard_weekly_posts"
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_campaign_accounts_campaign_id"
        ON "campaign_accounts" ("campaign_id");
      CREATE INDEX "IDX_campaign_accounts_connected_account_id"
        ON "campaign_accounts" ("connected_account_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_accounts"`);
  }
}
