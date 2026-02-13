import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaVersioning1770600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD "parent_media_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "version" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "parent_media_id"`);
  }
}
