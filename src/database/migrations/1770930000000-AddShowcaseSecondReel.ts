import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowcaseSecondReel1770930000000 implements MigrationInterface {
  name = 'AddShowcaseSecondReel1770930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "showcase" ADD COLUMN IF NOT EXISTS "reel_media_id_2" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "showcase" ADD COLUMN IF NOT EXISTS "reel_clip_blob_id_2" text`,
    );
    await queryRunner.query(
      `UPDATE "showcase"
       SET "reel_media_id_2" = 'b034bc87-1673-48de-9317-ff08f7ecacb5'
       WHERE id = (SELECT id FROM "showcase" ORDER BY created_at ASC LIMIT 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "showcase" DROP COLUMN IF EXISTS "reel_clip_blob_id_2"`);
    await queryRunner.query(`ALTER TABLE "showcase" DROP COLUMN IF EXISTS "reel_media_id_2"`);
  }
}
