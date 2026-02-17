import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Set showcase reel source media. After this migration, run from backend:
 *   npm run upload-showcase-clips
 * That script creates a 2s clip from this media, uploads it, and sets reel_clip_blob_id
 * so the dashboard shows the clip (not the full video).
 */
export class SetShowcaseReelMediaIds1770920000000 implements MigrationInterface {
  name = 'SetShowcaseReelMediaIds1770920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "showcase"
       SET "reel_media_id" = 'ca183863-fed1-4394-9bd7-06e4b3b0e537'
       WHERE id = (SELECT id FROM "showcase" ORDER BY created_at ASC LIMIT 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "showcase"
       SET "reel_media_id" = NULL
       WHERE id = (SELECT id FROM "showcase" ORDER BY created_at ASC LIMIT 1)`,
    );
  }
}
