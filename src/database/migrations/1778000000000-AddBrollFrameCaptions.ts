import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrollFrameCaptions1778000000000 implements MigrationInterface {
  name = 'AddBrollFrameCaptions1778000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broll_frame_embeddings" ADD COLUMN IF NOT EXISTS "caption" TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE "broll_videos" ADD COLUMN IF NOT EXISTS "video_summary" TEXT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "broll_videos" DROP COLUMN IF EXISTS "video_summary"`);
    await queryRunner.query(`ALTER TABLE "broll_frame_embeddings" DROP COLUMN IF EXISTS "caption"`);
  }
}
