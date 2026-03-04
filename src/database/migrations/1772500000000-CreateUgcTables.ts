import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUgcTables1772500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ugc_actors: portrait catalog for AI actor generation
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ugc_actors" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" TEXT NOT NULL,
        "gender" VARCHAR(20) NOT NULL DEFAULT 'neutral',
        "age_group" VARCHAR(20) NOT NULL DEFAULT 'adult',
        "region" VARCHAR(50) NOT NULL DEFAULT 'us',
        "style" VARCHAR(50) NOT NULL DEFAULT 'casual',
        "portrait_s3_key" TEXT NOT NULL,
        "preview_s3_key" TEXT,
        "voice_id" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "usage_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // ugc_content_library: b-roll and reaction clips
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ugc_content_library" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" TEXT NOT NULL,
        "s3_key" TEXT NOT NULL UNIQUE,
        "clip_type" VARCHAR(50) NOT NULL DEFAULT 'broll',
        "category_tags" TEXT[] NOT NULL DEFAULT '{}',
        "duration_seconds" FLOAT,
        "thumbnail_s3_key" TEXT,
        "usage_count" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ugc_content_tags" ON "ugc_content_library" USING GIN ("category_tags")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ugc_content_type" ON "ugc_content_library" ("clip_type")
    `);

    // ugc_ab_tests: A/B test tracking for hook and actor variants
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ugc_ab_tests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "parent_media_id" uuid NOT NULL,
        "variant_media_id" uuid NOT NULL,
        "variant_type" VARCHAR(50) NOT NULL DEFAULT 'hook',
        "variant_label" TEXT,
        "view_count" INTEGER NOT NULL DEFAULT 0,
        "click_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ugc_ab_parent" ON "ugc_ab_tests" ("parent_media_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ugc_ab_tests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ugc_content_library"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ugc_actors"`);
  }
}
