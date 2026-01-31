
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [],
});

async function checkUserFinal() {
    const email = 'vatsal.p+1123@gmail.com';
    await AppDataSource.initialize();
    const res = await AppDataSource.query('SELECT email, email_verified, verification_token FROM users WHERE email = $1;', [email]);
    console.log(JSON.stringify(res, null, 2));
    await AppDataSource.destroy();
}

checkUserFinal().catch(console.error);
