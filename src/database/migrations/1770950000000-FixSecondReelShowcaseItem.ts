import { MigrationInterface, QueryRunner } from 'typeorm';

const MEDIA_ID_SECOND_REEL = 'b034bc87-1673-48de-9317-ff08f7ecacb5';

/**
 * Delete the second reel showcase item (broken clip URL) and insert a fresh row
 * with the same media_id. Run `npm run upload-showcase-clips` after this to
 * generate and store the clip for this media.
 */
export class FixSecondReelShowcaseItem1770950000000 implements MigrationInterface {
  name = 'FixSecondReelShowcaseItem1770950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "showcase_item"
       WHERE "type" = 'reel' AND "media_id" = $1`,
      [MEDIA_ID_SECOND_REEL],
    );

    await queryRunner.query(
      `INSERT INTO "showcase_item" ("type", "sort_order", "media_id", "clip_blob_id", "created_at", "updated_at")
       VALUES ('reel', 1, $1, NULL, NOW(), NOW())`,
      [MEDIA_ID_SECOND_REEL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "showcase_item"
       WHERE "type" = 'reel' AND "media_id" = $1`,
      [MEDIA_ID_SECOND_REEL],
    );
  }
}
