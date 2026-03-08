import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrollAirImports1777000000000 implements MigrationInterface {
  name = 'AddBrollAirImports1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "broll_air_imports" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id"     uuid NOT NULL REFERENCES "broll_libraries"("id") ON DELETE CASCADE,
        "user_id"        uuid NOT NULL,
        "board_url"      TEXT NOT NULL,
        "board_id"       TEXT NOT NULL,
        "status"         VARCHAR(20) NOT NULL DEFAULT 'running',
        "total_clips"    INT NOT NULL DEFAULT 0,
        "imported_clips" INT NOT NULL DEFAULT 0,
        "failed_clips"   INT NOT NULL DEFAULT 0,
        "error_message"  TEXT,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_broll_air_imports_library" ON "broll_air_imports"("library_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_broll_air_imports_library"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "broll_air_imports"`);
  }
}
