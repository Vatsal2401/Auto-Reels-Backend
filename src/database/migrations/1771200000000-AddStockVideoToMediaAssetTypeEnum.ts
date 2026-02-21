import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockVideoToMediaAssetTypeEnum1771200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'stock_video'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Removing enum values requires recreating the type in Postgres.
    // Not implemented to avoid data loss risk.
  }
}
