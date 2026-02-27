import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectShareToken1771900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS share_token VARCHAR(36) DEFAULT NULL UNIQUE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projects DROP COLUMN IF EXISTS share_token
    `);
  }
}
