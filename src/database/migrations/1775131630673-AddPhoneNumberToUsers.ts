import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneNumberToUsers1775131630673 implements MigrationInterface {
    name = 'AddPhoneNumberToUsers1775131630673'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_number" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_number"`);
    }
}
