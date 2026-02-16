import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowcaseTable1770900000000 implements MigrationInterface {
  name = 'AddShowcaseTable1770900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "showcase" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reel_media_id" uuid,
        "graphic_motion_project_id" uuid,
        "text_to_image_url" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_showcase" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `INSERT INTO "showcase" ("id", "reel_media_id", "graphic_motion_project_id", "text_to_image_url", "created_at", "updated_at")
       VALUES (
         uuid_generate_v4(),
         'd5b08f5b-b43f-45aa-be5e-395882fbeb84',
         '3f70e2ee-ddce-477f-b7af-85c34a89f961',
         'https://placehold.co/400x600/1a1a2e/6366f1?text=Text+to+Image',
         now(),
         now()
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "showcase"`);
  }
}
