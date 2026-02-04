import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ai_reels',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function checkSteps(mediaId: string) {
    try {
        await AppDataSource.initialize();
        console.log(`🔍 Raw DB Check for Media: ${mediaId}`);

        const steps = await AppDataSource.query(
            'SELECT * FROM media_steps WHERE media_id = $1 ORDER BY created_at ASC',
            [mediaId]
        );

        console.log('\n--- All Steps (Raw SQL) ---');
        steps.forEach((step: any) => {
            console.log(`ID: ${step.id} | Step: ${step.step} | Status: ${step.status} | Blob: ${step.blob_storage_id} | CreatedAt: ${step.created_at}`);
        });

        const assets = await AppDataSource.query(
            'SELECT * FROM media_assets WHERE media_id = $1 ORDER BY created_at ASC',
            [mediaId]
        );

        console.log('\n--- All Assets (Raw SQL) ---');
        assets.forEach((asset: any) => {
            console.log(`ID: ${asset.id} | Type: ${asset.type} | CreatedAt: ${asset.created_at} | Blob: ${asset.blob_storage_id}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

const mediaId = process.argv[2] || 'd2114fcd-6940-45b0-9c8f-7e580c0db62d';
checkSteps(mediaId);
