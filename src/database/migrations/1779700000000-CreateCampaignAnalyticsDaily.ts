import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignAnalyticsDaily1779700000000 implements MigrationInterface {
  name = 'CreateCampaignAnalyticsDaily1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "campaign_analytics_daily" (
        "id"                     uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id"            uuid      NOT NULL,
        "date"                   date      NOT NULL,
        "posts_published"        int       NOT NULL DEFAULT 0,
        "posts_failed"           int       NOT NULL DEFAULT 0,
        "total_views"            bigint    NOT NULL DEFAULT 0,
        "total_likes"            bigint    NOT NULL DEFAULT 0,
        "total_comments"         bigint    NOT NULL DEFAULT 0,
        "total_shares"           bigint    NOT NULL DEFAULT 0,
        "total_saves"            bigint    NOT NULL DEFAULT 0,
        "avg_engagement_rate"    decimal(5,2),
        "followers_gained"       int       NOT NULL DEFAULT 0,
        "platform_breakdown"     jsonb     NOT NULL DEFAULT '{}',
        "content_type_breakdown" jsonb     NOT NULL DEFAULT '{}',
        "created_at"             TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"             TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_analytics_daily" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_campaign_analytics_daily_campaign_date"
          UNIQUE ("campaign_id", "date"),
        CONSTRAINT "FK_cad_campaign"
          FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_cad_posts_positive"
          CHECK ("posts_published" >= 0 AND "posts_failed" >= 0),
        CONSTRAINT "CHK_cad_metrics_positive"
          CHECK (
            "total_views" >= 0 AND "total_likes" >= 0 AND
            "total_comments" >= 0 AND "total_shares" >= 0 AND
            "total_saves" >= 0 AND "followers_gained" >= 0
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cad_campaign_id_date"
        ON "campaign_analytics_daily" ("campaign_id", "date" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_analytics_daily"`);
  }
}
