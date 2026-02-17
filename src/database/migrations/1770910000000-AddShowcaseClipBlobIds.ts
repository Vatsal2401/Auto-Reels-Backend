import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowcaseClipBlobIds1770910000000 implements MigrationInterface {
  name = 'AddShowcaseClipBlobIds1770910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "showcase"
       ADD COLUMN IF NOT EXISTS "reel_clip_blob_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "showcase"
       ADD COLUMN IF NOT EXISTS "graphic_motion_clip_blob_id" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "showcase" DROP COLUMN IF EXISTS "reel_clip_blob_id"`);
    await queryRunner.query(
      `ALTER TABLE "showcase" DROP COLUMN IF EXISTS "graphic_motion_clip_blob_id"`,
    );
  }
}
