import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdirSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { dirname } from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MEDIA_ID = '01fbac0d-cc1b-48ac-9072-02ff338a93b0';
const DOWNLOAD_DIR = path.resolve(__dirname, '../../downloads', MEDIA_ID);

// DB Connection
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

// S3 Clients
let s3Client: S3Client;
let bucketName: string;

function initS3() {
    const storageType = process.env.CURRENT_BLOB_STORAGE || 's3';

    if (storageType === 'supabase') {
        const endpoint = process.env.SUPABASE_STORAGE_ENDPOINT;
        const region = process.env.SUPABASE_STORAGE_REGION || 'us-east-1';

        console.log(`🔌 Initializing Supabase Storage (S3 Compatible) at ${region}`);

        s3Client = new S3Client({
            region: region,
            endpoint: endpoint,
            credentials: {
                accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
            },
            forcePathStyle: true,
        });

        bucketName = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';
    } else {
        console.log(`🔌 Initializing AWS S3 Storage`);
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        bucketName = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
    }
}

async function downloadFile(key: string, localPath: string) {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        const response = await s3Client.send(command);

        const dir = dirname(localPath);
        mkdirSync(dir, { recursive: true });

        await pipeline(response.Body as Readable, createWriteStream(localPath));
        console.log(`✅ Downloaded: ${key} -> ${localPath}`);
    } catch (error: any) {
        console.error(`❌ Failed to download ${key}:`, error.message);
    }
}

async function main() {
    await AppDataSource.initialize();
    initS3();

    console.log(`\n📂 Finding assets for Media ID: ${MEDIA_ID}`);

    // 1. Get Media Record (Final Video)
    const media = await AppDataSource.query('SELECT blob_storage_id FROM media WHERE id = $1', [MEDIA_ID]);
    if (media.length > 0 && media[0].blob_storage_id) {
        const key = media[0].blob_storage_id;
        const filename = path.basename(key);
        await downloadFile(key, path.join(DOWNLOAD_DIR, 'final_output', filename));
    }

    // 2. Get Media Assets (Input/Uploaded files)
    const assets = await AppDataSource.query('SELECT type, blob_storage_id FROM media_assets WHERE media_id = $1', [MEDIA_ID]);
    console.log(`Found ${assets.length} raw assets.`);
    for (const asset of assets) {
        if (asset.blob_storage_id) {
            const key = asset.blob_storage_id;
            const filename = path.basename(key);
            await downloadFile(key, path.join(DOWNLOAD_DIR, 'assets', asset.type || 'unknown', filename));
        }
    }

    // 3. Get Media Steps (Intermediate outputs)
    const steps = await AppDataSource.query('SELECT step_key, blob_storage_id FROM media_steps WHERE media_id = $1', [MEDIA_ID]);
    console.log(`Found ${steps.length} steps.`);
    for (const step of steps) {
        // blob_storage_id can be a string or array of strings (JSON)
        // Check if it's a JSON string array or simple string
        let blobIds: string[] = [];

        try {
            // Handle if stored as JSON array string "[\"path1\", \"path2\"]"
            if (typeof step.blob_storage_id === 'string' && step.blob_storage_id.startsWith('[')) {
                blobIds = JSON.parse(step.blob_storage_id);
            } else if (step.blob_storage_id) {
                blobIds = [step.blob_storage_id];
            }
        } catch (e) {
            if (step.blob_storage_id) blobIds = [step.blob_storage_id];
        }

        for (const key of blobIds) {
            if (typeof key === 'string') {
                const filename = path.basename(key);
                await downloadFile(key, path.join(DOWNLOAD_DIR, 'steps', step.step_key || 'unknown', filename));
            }
        }
    }

    console.log(`\n🎉 All downloads complete! Check folder: ${DOWNLOAD_DIR}`);
    await AppDataSource.destroy();
}

main().catch(console.error);
