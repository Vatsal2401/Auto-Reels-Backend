import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToUsers1776533245068 implements MigrationInterface {
  name = 'AddSoftDeleteToUsers1776533245068';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
  }
}
