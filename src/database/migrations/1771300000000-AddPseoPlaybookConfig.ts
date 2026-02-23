import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPseoPlaybookConfig1771300000000 implements MigrationInterface {
  name = 'AddPseoPlaybookConfig1771300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pseo_playbook_configs" (
        "playbook" text NOT NULL,
        "display_name" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "min_quality_score" integer NOT NULL DEFAULT 60,
        "min_word_count" integer NOT NULL DEFAULT 400,
        "url_prefix" text,
        "description" text,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pseo_playbook_configs" PRIMARY KEY ("playbook")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "pseo_playbook_configs" ("playbook", "display_name", "enabled", "min_quality_score", "min_word_count", "url_prefix") VALUES
      ('templates',    'Templates',    true, 60, 600, '/tools'),
      ('curation',     'Curation',     true, 60, 600, '/ideas'),
      ('conversions',  'Conversions',  true, 60, 400, '/pricing'),
      ('comparisons',  'Comparisons',  true, 60, 600, '/vs'),
      ('examples',     'Examples',     true, 60, 600, '/examples'),
      ('locations',    'Locations',    true, 60, 400, null),
      ('personas',     'Personas',     true, 60, 500, '/for'),
      ('integrations', 'Integrations', true, 60, 400, '/integrations'),
      ('glossary',     'Glossary',     true, 60, 300, '/glossary'),
      ('translations', 'Translations', true, 60, 400, '/create'),
      ('directory',    'Directory',    true, 60, 300, '/directory'),
      ('profiles',     'Profiles',     true, 60, 400, '/tools')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pseo_playbook_configs"`);
  }
}
