import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePseoPages1771100000000 implements MigrationInterface {
  name = 'CreatePseoPages1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."pseo_pages_playbook_enum" AS ENUM('templates','curation','conversions','comparisons','examples','locations','personas','integrations','glossary','translations','directory','profiles')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pseo_pages_status_enum" AS ENUM('draft','generating','generated','validating','published','failed','archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pseo_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" text NOT NULL,
        "canonical_path" text NOT NULL,
        "playbook" "public"."pseo_pages_playbook_enum" NOT NULL,
        "status" "public"."pseo_pages_status_enum" NOT NULL DEFAULT 'draft',
        "title" text NOT NULL,
        "meta_description" text NOT NULL,
        "keywords" text array NOT NULL DEFAULT '{}',
        "content" jsonb,
        "seed_params" jsonb,
        "related_paths" text array NOT NULL DEFAULT '{}',
        "word_count" integer,
        "quality_score" integer,
        "generation_attempts" integer NOT NULL DEFAULT '0',
        "generation_error" text,
        "published_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pseo_pages_slug" UNIQUE ("slug"),
        CONSTRAINT "UQ_pseo_pages_canonical_path" UNIQUE ("canonical_path"),
        CONSTRAINT "PK_pseo_pages" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_pseo_slug" ON "pseo_pages" ("slug")`);
    await queryRunner.query(
      `CREATE INDEX "idx_pseo_playbook_status" ON "pseo_pages" ("playbook", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pseo_published_at" ON "pseo_pages" ("published_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_pseo_published_at"`);
    await queryRunner.query(`DROP INDEX "idx_pseo_playbook_status"`);
    await queryRunner.query(`DROP INDEX "idx_pseo_slug"`);
    await queryRunner.query(`DROP TABLE "pseo_pages"`);
    await queryRunner.query(`DROP TYPE "public"."pseo_pages_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."pseo_pages_playbook_enum"`);
  }
}
