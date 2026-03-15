import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignPostToScheduledPosts1779800000000 implements MigrationInterface {
  name = 'AddCampaignPostToScheduledPosts1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // campaign_posts table now exists (created in 1779300000000)
    // Nullable column — all existing scheduled_posts rows are unaffected (campaign_post_id = NULL)
    await queryRunner.query(`
      ALTER TABLE "scheduled_posts"
        ADD COLUMN "campaign_post_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_posts"
        ADD CONSTRAINT "FK_scheduled_posts_campaign_post"
          FOREIGN KEY ("campaign_post_id")
          REFERENCES "campaign_posts"("id")
          ON DELETE SET NULL
    `);

    // Partial index — only indexes campaign-linked rows; zero overhead for standalone posts
    await queryRunner.query(`
      CREATE INDEX "IDX_scheduled_posts_campaign_post_id"
        ON "scheduled_posts" ("campaign_post_id")
        WHERE "campaign_post_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_scheduled_posts_campaign_post_id"`);
    await queryRunner.query(`
      ALTER TABLE "scheduled_posts"
        DROP CONSTRAINT "FK_scheduled_posts_campaign_post"
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_posts"
        DROP COLUMN "campaign_post_id"
    `);
  }
}
