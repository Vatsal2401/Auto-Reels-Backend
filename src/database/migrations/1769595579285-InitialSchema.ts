import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1769595579285 implements MigrationInterface {
    name = 'InitialSchema1769595579285'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."jobs_job_type_enum" AS ENUM('script', 'audio', 'caption', 'asset', 'render')`);
        await queryRunner.query(`CREATE TYPE "public"."jobs_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_id" uuid NOT NULL, "job_type" "public"."jobs_job_type_enum" NOT NULL, "status" "public"."jobs_status_enum" NOT NULL DEFAULT 'pending', "bullmq_job_id" text, "result_data" jsonb, "error_message" text, "retry_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."assets_asset_type_enum" AS ENUM('video', 'image', 'audio', 'caption')`);
        await queryRunner.query(`CREATE TABLE "assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_id" uuid NOT NULL, "asset_type" "public"."assets_asset_type_enum" NOT NULL, "s3_url" text NOT NULL, "s3_key" text NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_auth_provider_enum" AS ENUM('email', 'google', 'microsoft')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255), "name" character varying(100), "avatar_url" text, "auth_provider" "public"."users_auth_provider_enum" NOT NULL DEFAULT 'email', "provider_id" character varying(255), "email_verified" boolean NOT NULL DEFAULT false, "refresh_token" character varying(255), "credits_balance" integer NOT NULL DEFAULT '0', "credits_purchased_total" integer NOT NULL DEFAULT '0', "is_premium" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_6425135effde2ab8322f8464932" UNIQUE ("provider_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."videos_status_enum" AS ENUM('pending', 'script_generating', 'script_complete', 'processing', 'rendering', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "topic" text NOT NULL, "status" "public"."videos_status_enum" NOT NULL DEFAULT 'pending', "script" text, "script_json" jsonb, "script_generated_at" TIMESTAMP, "audio_url" text, "caption_url" text, "asset_urls" jsonb, "image_urls" jsonb, "generated_video_url" text, "final_video_url" text, "error_message" text, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "jobs" ADD CONSTRAINT "FK_eace0b43b8161a17b423f826e01" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_6b186028f5b00484d3498504f2a" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "videos" ADD CONSTRAINT "FK_900733992fb36a6d855308c0039" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_900733992fb36a6d855308c0039"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_6b186028f5b00484d3498504f2a"`);
        await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "FK_eace0b43b8161a17b423f826e01"`);
        await queryRunner.query(`DROP TABLE "videos"`);
        await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_auth_provider_enum"`);
        await queryRunner.query(`DROP TABLE "assets"`);
        await queryRunner.query(`DROP TYPE "public"."assets_asset_type_enum"`);
        await queryRunner.query(`DROP TABLE "jobs"`);
        await queryRunner.query(`DROP TYPE "public"."jobs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."jobs_job_type_enum"`);
    }

}
