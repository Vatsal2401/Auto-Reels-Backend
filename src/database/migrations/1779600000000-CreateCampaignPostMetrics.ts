import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignPostMetrics1779600000000 implements MigrationInterface {
  name = 'CreateCampaignPostMetrics1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "campaign_post_metrics" (
        "id"                   uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_post_id"     uuid        NOT NULL,
        "scheduled_post_id"    uuid        NOT NULL,
        "platform"             varchar(20) NOT NULL,
        "connected_account_id" uuid        NOT NULL,
        "views"                bigint      NOT NULL DEFAULT 0,
        "likes"                bigint      NOT NULL DEFAULT 0,
        "comments"             bigint      NOT NULL DEFAULT 0,
        "shares"               bigint      NOT NULL DEFAULT 0,
        "saves"                bigint      NOT NULL DEFAULT 0,
        "reach"                bigint      NOT NULL DEFAULT 0,
        "impressions"          bigint      NOT NULL DEFAULT 0,
        "followers_gained"     int         NOT NULL DEFAULT 0,
        "engagement_rate"      decimal(5,2),
        "metrics_fetched_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_post_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_campaign_post_metrics_scheduled_post"
          UNIQUE ("scheduled_post_id"),
        CONSTRAINT "FK_cpm_campaign_post"
          FOREIGN KEY ("campaign_post_id") REFERENCES "campaign_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cpm_scheduled_post"
          FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cpm_connected_account"
          FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_cpm_platform"
          CHECK ("platform" IN ('instagram', 'tiktok', 'youtube')),
        CONSTRAINT "CHK_cpm_views_positive"        CHECK ("views"       >= 0),
        CONSTRAINT "CHK_cpm_likes_positive"        CHECK ("likes"       >= 0),
        CONSTRAINT "CHK_cpm_comments_positive"     CHECK ("comments"    >= 0),
        CONSTRAINT "CHK_cpm_shares_positive"       CHECK ("shares"      >= 0),
        CONSTRAINT "CHK_cpm_saves_positive"        CHECK ("saves"       >= 0),
        CONSTRAINT "CHK_cpm_reach_positive"        CHECK ("reach"       >= 0),
        CONSTRAINT "CHK_cpm_impressions_positive"  CHECK ("impressions" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cpm_campaign_post_id"
        ON "campaign_post_metrics" ("campaign_post_id");
      CREATE INDEX "IDX_cpm_platform"
        ON "campaign_post_metrics" ("connected_account_id", "platform");
      CREATE INDEX "IDX_cpm_metrics_fetched_at"
        ON "campaign_post_metrics" ("metrics_fetched_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_post_metrics"`);
  }
}
