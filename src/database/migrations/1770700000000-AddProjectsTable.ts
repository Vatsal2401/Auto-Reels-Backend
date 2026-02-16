import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectsTable1770700000000 implements MigrationInterface {
  name = 'AddProjectsTable1770700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."projects_status_enum" AS ENUM(
        'pending',
        'processing',
        'rendering',
        'completed',
        'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "tool_type" character varying(50) NOT NULL,
        "status" "public"."projects_status_enum" NOT NULL DEFAULT 'pending',
        "output_url" text,
        "thumbnail_url" text,
        "metadata" jsonb,
        "duration" integer,
        "credit_cost" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        CONSTRAINT "PK_projects_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD CONSTRAINT "FK_projects_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_user"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
  }
}
