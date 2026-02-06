import { DataSource } from 'typeorm';
import { Media } from '../src/media/entities/media.entity';
import { MediaStep } from '../src/media/entities/media-step.entity';
import { MediaAsset } from '../src/media/entities/media-asset.entity';
import { User } from '../src/auth/entities/user.entity';
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
    entities: [Media, MediaStep, MediaAsset, User],
    synchronize: false,
});

async function inspect(mediaId: string) {
    try {
        await AppDataSource.initialize();
        console.log(`🔍 Inspecting Media: ${mediaId}`);

        const media = await AppDataSource.getRepository(Media).findOne({
            where: { id: mediaId },
            relations: ['steps', 'assets'],
        });

        if (!media) {
            console.log('❌ Media not found');
            return;
        }

        console.log('\n--- Media Details ---');
        console.log(`Status: ${media.status}`);
        console.log(`Input Config: ${JSON.stringify(media.input_config, null, 2)}`);
        console.log(`Error: ${media.error_message || 'None'}`);

        console.log('\n--- Steps ---');
        media.steps.sort((a, b) => a.created_at.getTime() - b.created_at.getTime()).forEach(step => {
            console.log(` - [${step.step}] Status: ${step.status}, Blob: ${step.blob_storage_id}, Error: ${step.error_message || 'None'}`);
        });

        console.log('\n--- Assets ---');
        media.assets.forEach(asset => {
            console.log(` - [${asset.type}] Blob: ${asset.blob_storage_id}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

const mediaId = process.argv[2] || 'd2114fcd-6940-45b0-9c8f-7e580c0db62d';
inspect(mediaId);
