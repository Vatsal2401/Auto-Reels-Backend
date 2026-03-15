import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignPosts1779300000000 implements MigrationInterface {
  name = 'CreateCampaignPosts1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "campaign_posts_type_enum" AS ENUM (
        'reel', 'carousel', 'story', 'ugc_video', 'image', 'graphic_motion'
      );
      CREATE TYPE "campaign_posts_content_source_enum" AS ENUM ('new', 'existing');
      CREATE TYPE "campaign_posts_pipeline_status_enum" AS ENUM (
        'draft', 'generating', 'ready', 'awaiting_schedule',
        'scheduled', 'publishing', 'published', 'failed'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "campaign_posts" (
        "id"                   uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id"          uuid         NOT NULL,
        "day_number"           int          NOT NULL,
        "sort_order"           int          NOT NULL DEFAULT 0,
        "post_type"            "campaign_posts_type_enum"            NOT NULL,
        "content_source"       "campaign_posts_content_source_enum"  NOT NULL DEFAULT 'new',
        "source_entity_type"   varchar(40),
        "source_entity_id"     uuid,
        "rendered_s3_key"      text,
        "render_job_id"        varchar(255),
        "render_error"         text,
        "ai_generation_job_id" varchar(255),
        "ai_generation_error"  text,
        "title"                varchar(500),
        "hook"                 text,
        "caption"              text,
        "script"               text,
        "hashtags"             text,
        "target_platforms"     text[]       NOT NULL DEFAULT '{}',
        "pipeline_status"      "campaign_posts_pipeline_status_enum" NOT NULL DEFAULT 'draft',
        "pipeline_error"       text,
        "scheduled_at"         TIMESTAMPTZ,
        "published_at"         TIMESTAMPTZ,
        "created_at"           TIMESTAMP    NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_campaign_posts_campaign"
          FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_campaign_posts_day_number"
          CHECK ("day_number" > 0),
        CONSTRAINT "CHK_campaign_posts_sort_order"
          CHECK ("sort_order" >= 0),
        CONSTRAINT "CHK_campaign_posts_source_consistency"
          CHECK (
            "content_source" = 'new'
            OR ("source_entity_type" IS NOT NULL AND "source_entity_id" IS NOT NULL)
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_campaign_posts_campaign_id"
        ON "campaign_posts" ("campaign_id");
      CREATE INDEX "IDX_campaign_posts_campaign_day_order"
        ON "campaign_posts" ("campaign_id", "day_number", "sort_order");
      CREATE INDEX "IDX_campaign_posts_pipeline_status"
        ON "campaign_posts" ("pipeline_status");
      CREATE INDEX "IDX_campaign_posts_scheduled_at"
        ON "campaign_posts" ("scheduled_at")
        WHERE "scheduled_at" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "campaign_posts"`);
    await queryRunner.query(`DROP TYPE "campaign_posts_pipeline_status_enum"`);
    await queryRunner.query(`DROP TYPE "campaign_posts_content_source_enum"`);
    await queryRunner.query(`DROP TYPE "campaign_posts_type_enum"`);
  }
}
