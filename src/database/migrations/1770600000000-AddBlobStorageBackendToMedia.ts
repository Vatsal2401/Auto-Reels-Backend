import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlobStorageBackendToMedia1770600000000 implements MigrationInterface {
  name = 'AddBlobStorageBackendToMedia1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" ADD "blob_storage_backend" character varying`);
    await queryRunner.query(
      `UPDATE "media" SET "blob_storage_backend" = 'supabase' WHERE "blob_storage_backend" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "blob_storage_backend"`);
  }
}
