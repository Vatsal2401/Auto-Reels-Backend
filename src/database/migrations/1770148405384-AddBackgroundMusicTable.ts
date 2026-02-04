import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBackgroundMusicTable1770148405384 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "background_music" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" text NOT NULL,
                "blob_storage_id" text NOT NULL,
                "category" text,
                "user_id" uuid,
                "is_system" boolean NOT NULL DEFAULT false,
                "metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_background_music" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key to users if it exists
    await queryRunner.query(`
            ALTER TABLE "background_music" 
            ADD CONSTRAINT "FK_background_music_user" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") 
            ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "background_music" DROP CONSTRAINT "FK_background_music_user"`,
    );
    await queryRunner.query(`DROP TABLE "background_music"`);
  }
}
