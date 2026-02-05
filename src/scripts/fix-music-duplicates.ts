import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const categories = [
  {
    name: 'Viral Phonk Night',
    category: 'TRENDING',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    name: 'Deep Aesthetic Chill',
    category: 'LOFI',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    name: 'Cinematic Storytelling',
    category: 'STORY',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    name: 'Action Hype Beat',
    category: 'ENERGY',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
  {
    name: 'Mysterious Suspense',
    category: 'SUSPENSE',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
  },
  {
    name: 'Happy Summer Glow',
    category: 'HAPPY',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
  },
  {
    name: 'Corporate Growth',
    category: 'MOTIVATIONAL',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
];

async function bootstrap() {
  console.log('🚀 Starting Music Duplicate Fixer...');

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('📦 Database Connected.');
  } catch (err: any) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // S3 Init
  let s3: S3Client | null = null;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';

  if (process.env.CURRENT_BLOB_STORAGE === 'supabase') {
    s3 = new S3Client({
      region: process.env.SUPABASE_STORAGE_REGION || 'ap-northeast-1',
      endpoint: process.env.SUPABASE_STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true,
    });
    console.log('☁️  Supabase S3 Storage Initialized.');
  }

  // DELETE
  console.log('🧹 Clearing ALL existing system music...');
  const deleteRes = await client.query('DELETE FROM background_music WHERE is_system = true');
  console.log(`🗑️  Deleted ${deleteRes.rowCount} existing system tracks.`);

  // RE-SEED
  for (const item of categories) {
    console.log(`⬇️  Downloading ${item.name}...`);
    try {
      const response = await axios.get(item.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      const buffer = Buffer.from(response.data);

      const fileName = `${item.name.toLowerCase().replace(/\s+/g, '-')}.mp3`;
      const blobId = `users/system/media/seed-music/audio/${fileName}`;

      if (s3) {
        console.log(`📤 Uploading to Supabase: ${blobId}...`);
        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: blobId,
              Body: buffer,
              ContentType: 'audio/mpeg',
            }),
          );
        } catch (s3Err: any) {
          console.error('⚠️ S3 Upload Warning:', s3Err.message);
        }
      }

      const id = uuidv4();
      const metadata = JSON.stringify({
        size: buffer.length,
        duration: 120, // Mock duration
        originalUrl: item.url,
      });

      await client.query(
        `INSERT INTO background_music (id, name, category, blob_storage_id, is_system, metadata, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [id, item.name, item.category, blobId, true, metadata],
      );

      console.log(`✅ Success: ${item.name}`);
    } catch (error: any) {
      console.error(`❌ Failed ${item.name}:`, error.message);
    }
  }

  await client.end();
  console.log('✨ Fix complete!');
}

bootstrap().catch(console.error);
