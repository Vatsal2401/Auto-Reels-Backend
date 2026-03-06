import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryAndUgcAssetTypeEnums1772800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'ugc_brief'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'ugc_script'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'broll'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'actor_video'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'story_script'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'story_images'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'story_audio'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."media_assets_type_enum" ADD VALUE IF NOT EXISTS 'story_captions'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support DROP VALUE from an enum.
    // To reverse: recreate the enum without these values and migrate the column.
  }
}
