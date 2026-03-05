import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoryTables1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "media_id" uuid REFERENCES "media"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "title" TEXT,
        "prompt" TEXT NOT NULL,
        "genre" VARCHAR(50) NOT NULL,
        "scene_count" INTEGER NOT NULL DEFAULT 5,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stories_media_id" ON "stories" ("media_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stories_user_id" ON "stories" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_characters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
        "name" TEXT NOT NULL,
        "appearance" TEXT NOT NULL,
        "clothing" TEXT,
        "style" TEXT,
        "consistency_anchor" TEXT NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_story_characters_story_id" ON "story_characters" ("story_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "story_scenes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
        "scene_number" INTEGER NOT NULL,
        "description" TEXT,
        "image_prompt" TEXT,
        "subtitle" TEXT,
        "narration" TEXT,
        "camera_motion" VARCHAR(30),
        "image_url" TEXT,
        "duration_seconds" FLOAT,
        "start_time_seconds" FLOAT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_story_scenes_story_id" ON "story_scenes" ("story_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "story_scenes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "story_characters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stories"`);
  }
}
