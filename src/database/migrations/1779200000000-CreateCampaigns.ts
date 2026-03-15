import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaigns1779200000000 implements MigrationInterface {
  name = 'CreateCampaigns1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "campaigns_status_enum" AS ENUM ('draft', 'active', 'paused', 'archived');
      CREATE TYPE "campaigns_goal_type_enum" AS ENUM ('grow_following', 'lead_generation', 'product_sales', 'brand_awareness');
    `);

    await queryRunner.query(`
      CREATE TABLE "campaigns" (
        "id"                     uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"                uuid         NOT NULL,
        "name"                   varchar(255) NOT NULL,
        "status"                 "campaigns_status_enum" NOT NULL DEFAULT 'draft',
        "goal_type"              "campaigns_goal_type_enum" NOT NULL,
        "goal_description"       text,
        "visual_style"           varchar(40),
        "icp_criteria"           jsonb,
        "start_date"             date,
        "end_date"               date,
        "posting_cadence_days"   smallint     NOT NULL DEFAULT 1,
        "target_platforms"       text[]       NOT NULL DEFAULT '{}',
        "quality_score"          smallint,
        "cached_total_posts"     int          NOT NULL DEFAULT 0,
        "cached_published_posts" int          NOT NULL DEFAULT 0,
        "cached_total_views"     bigint       NOT NULL DEFAULT 0,
        "cached_avg_engagement"  decimal(5,2),
        "created_at"             TIMESTAMP    NOT NULL DEFAULT now(),
        "updated_at"             TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaigns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaigns_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_campaigns_dates" CHECK ("end_date" IS NULL OR "end_date" > "start_date"),
        CONSTRAINT "CHK_campaigns_cadence" CHECK ("posting_cadence_days" > 0),
        CONSTRAINT "CHK_campaigns_quality_score" CHECK ("quality_score" IS NULL OR ("quality_score" BETWEEN 0 AND 100)),
        CONSTRAINT "CHK_campaigns_cached_posts" CHECK ("cached_total_posts" >= 0 AND "cached_published_posts" >= 0),
        CONSTRAINT "CHK_campaigns_cached_views" CHECK ("cached_total_views" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_campaigns_user_id" ON "campaigns" ("user_id");
      CREATE INDEX "IDX_campaigns_user_status" ON "campaigns" ("user_id", "status");
      CREATE INDEX "IDX_campaigns_created_at" ON "campaigns" ("created_at" DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP TYPE "campaigns_status_enum"`);
    await queryRunner.query(`DROP TYPE "campaigns_goal_type_enum"`);
  }
}
