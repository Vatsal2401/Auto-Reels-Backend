import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntentToMediaAssetTypeEnum1769923759492 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."media_asset_type_enum" ADD VALUE 'intent'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removing enum values is tricky in Postgres, and usually not recommended without recreating the type.
    // For simplicity in this project, we'll leave it or comment out the reversal.
    // await queryRunner.query(`ALTER TYPE "public"."media_asset_type_enum" DROP VALUE 'intent'`);
  }
}
