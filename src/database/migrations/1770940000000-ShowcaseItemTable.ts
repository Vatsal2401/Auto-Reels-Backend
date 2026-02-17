import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShowcaseItemTable1770940000000 implements MigrationInterface {
  name = 'ShowcaseItemTable1770940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "showcase_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(50) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "media_id" uuid,
        "project_id" uuid,
        "clip_blob_id" text,
        "image_url" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_showcase_item" PRIMARY KEY ("id")
      )
    `);

    const rows = await queryRunner.query(
      `SELECT reel_media_id, reel_clip_blob_id, reel_media_id_2, reel_clip_blob_id_2,
              graphic_motion_project_id, graphic_motion_clip_blob_id, text_to_image_url
       FROM "showcase" ORDER BY created_at ASC LIMIT 1`,
    );
    const row = rows[0];
    if (row) {
      let sortOrder = 0;
      if (row.reel_media_id) {
        await queryRunner.query(
          `INSERT INTO "showcase_item" ("type", "sort_order", "media_id", "clip_blob_id", "created_at", "updated_at")
           VALUES ('reel', $1, $2, $3, NOW(), NOW())`,
          [sortOrder++, row.reel_media_id, row.reel_clip_blob_id || null],
        );
      }
      if (row.reel_media_id_2) {
        await queryRunner.query(
          `INSERT INTO "showcase_item" ("type", "sort_order", "media_id", "clip_blob_id", "created_at", "updated_at")
           VALUES ('reel', $1, $2, $3, NOW(), NOW())`,
          [sortOrder++, row.reel_media_id_2, row.reel_clip_blob_id_2 || null],
        );
      }
      if (row.graphic_motion_project_id) {
        await queryRunner.query(
          `INSERT INTO "showcase_item" ("type", "sort_order", "project_id", "clip_blob_id", "created_at", "updated_at")
           VALUES ('graphic_motion', $1, $2, $3, NOW(), NOW())`,
          [sortOrder++, row.graphic_motion_project_id, row.graphic_motion_clip_blob_id || null],
        );
      }
      if (row.text_to_image_url) {
        await queryRunner.query(
          `INSERT INTO "showcase_item" ("type", "sort_order", "image_url", "created_at", "updated_at")
           VALUES ('text_to_image', $1, $2, NOW(), NOW())`,
          [sortOrder++, row.text_to_image_url],
        );
      }
    }

    await queryRunner.query(`DROP TABLE "showcase"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "showcase" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reel_media_id" uuid,
        "reel_clip_blob_id" text,
        "reel_media_id_2" uuid,
        "reel_clip_blob_id_2" text,
        "graphic_motion_project_id" uuid,
        "graphic_motion_clip_blob_id" text,
        "text_to_image_url" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_showcase" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`DROP TABLE "showcase_item"`);
  }
}
