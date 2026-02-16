import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectIdToMedia1770700000001 implements MigrationInterface {
  name = 'AddProjectIdToMedia1770700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "media"
      ADD COLUMN "project_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "media"
      ADD CONSTRAINT "FK_media_project"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_media_project"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "project_id"`);
  }
}
