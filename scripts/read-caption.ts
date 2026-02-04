import { DataSource } from 'typeorm';
import { MediaAsset } from '../src/media/entities/media-asset.entity';
import { IStorageService } from '../src/storage/interfaces/storage.interface';
import { S3StorageProvider } from '../src/storage/providers/s3-storage.provider';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const storage = new S3StorageProvider(); // Requires env vars

async function checkCaption(mediaId: string) {
    try {
        console.log(`📥 Downloading caption for media: ${mediaId}`);
        const blobId = `users/777964c7-2284-4e00-b504-f1bb215a2bec/media/${mediaId}/caption/captions/captions.srt`;
        const buffer = await storage.download(blobId);
        const content = buffer.toString();

        console.log('\n--- Caption Content ---');
        console.log(content);
        console.log('--- End of Content ---');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

const mediaId = process.argv[2] || 'd2114fcd-6940-45b0-9c8f-7e580c0db62d';
checkCaption(mediaId);
