import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentEntities1770562962368 implements MigrationInterface {
  name = 'AddPaymentEntities1770562962368';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media_steps" DROP CONSTRAINT "FK_media_steps_media"`);
    await queryRunner.query(`ALTER TABLE "media_assets" DROP CONSTRAINT "FK_media_assets_media"`);
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_media_user"`);
    await queryRunner.query(
      `ALTER TABLE "background_music" DROP CONSTRAINT "FK_background_music_user"`,
    );
    await queryRunner.query(
      `CREATE TABLE "credit_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "credits" integer NOT NULL, "price_inr" integer NOT NULL, "price_usd" integer NOT NULL, "tag" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_89a6b83ffa0d39285e9214c4fc0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('created', 'paid', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "amount" integer NOT NULL, "currency" character varying(3) NOT NULL, "razorpay_order_id" character varying(255) NOT NULL, "razorpay_payment_id" character varying(255), "status" "public"."payments_status_enum" NOT NULL DEFAULT 'created', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6893f3785b8358418f32b74038c" UNIQUE ("razorpay_order_id"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "country" character varying(2)`);
    await queryRunner.query(
      `ALTER TYPE "public"."step_status_enum" RENAME TO "step_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_steps_status_enum" AS ENUM('pending', 'processing', 'success', 'failed')`,
    );
    await queryRunner.query(`ALTER TABLE "media_steps" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "media_steps" ALTER COLUMN "status" TYPE "public"."media_steps_status_enum" USING "status"::"text"::"public"."media_steps_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_steps" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."step_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."media_asset_type_enum" RENAME TO "media_asset_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_assets_type_enum" AS ENUM('script', 'audio', 'image', 'caption', 'video', 'avatar', 'intent')`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ALTER COLUMN "type" TYPE "public"."media_assets_type_enum" USING "type"::"text"::"public"."media_assets_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."media_asset_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "media_steps" ADD CONSTRAINT "FK_62e0a8f405fa1a301c331f37635" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ADD CONSTRAINT "FK_770acf79d9df7998a28094dd91a" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_c0dd13ee4ffc96e61bdc1fb592d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_427785468fb7d2733f59e7d7d39" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_f9b6a4c3196864cdd91b1a440ee" FOREIGN KEY ("plan_id") REFERENCES "credit_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_f9b6a4c3196864cdd91b1a440ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_427785468fb7d2733f59e7d7d39"`,
    );
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_c0dd13ee4ffc96e61bdc1fb592d"`);
    await queryRunner.query(
      `ALTER TABLE "media_assets" DROP CONSTRAINT "FK_770acf79d9df7998a28094dd91a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_steps" DROP CONSTRAINT "FK_62e0a8f405fa1a301c331f37635"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_asset_type_enum_old" AS ENUM('script', 'audio', 'image', 'caption', 'video', 'avatar', 'intent')`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ALTER COLUMN "type" TYPE "public"."media_asset_type_enum_old" USING "type"::"text"::"public"."media_asset_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."media_assets_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."media_asset_type_enum_old" RENAME TO "media_asset_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."step_status_enum_old" AS ENUM('pending', 'processing', 'success', 'failed')`,
    );
    await queryRunner.query(`ALTER TABLE "media_steps" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "media_steps" ALTER COLUMN "status" TYPE "public"."step_status_enum_old" USING "status"::"text"::"public"."step_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_steps" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."media_steps_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."step_status_enum_old" RENAME TO "step_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TABLE "credit_plans"`);
    await queryRunner.query(
      `ALTER TABLE "background_music" ADD CONSTRAINT "FK_background_music_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_media_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ADD CONSTRAINT "FK_media_assets_media" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_steps" ADD CONSTRAINT "FK_media_steps_media" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
