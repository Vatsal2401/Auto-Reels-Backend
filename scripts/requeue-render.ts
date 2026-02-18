/**
 * Re-queue a render job for a media: reset render step to processing and push to render-tasks.
 * Usage: npx ts-node -r dotenv/config scripts/requeue-render.ts <mediaId>
 */
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MEDIA_ID = process.argv[2] || '16a1ef47-783f-455c-942b-e01c1c03fd4d';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_reels',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function run() {
  await AppDataSource.initialize();

  const media = await AppDataSource.query(
    'SELECT id, user_id, input_config FROM media WHERE id = $1',
    [MEDIA_ID]
  );
  if (!media[0]) {
    console.error('Media not found:', MEDIA_ID);
    process.exit(1);
  }
  const { user_id: userId, input_config: inputConfig } = media[0];

  const renderStep = await AppDataSource.query(
    "SELECT id FROM media_steps WHERE media_id = $1 AND step = 'render'",
    [MEDIA_ID]
  );
  if (!renderStep[0]) {
    console.error('Render step not found for media:', MEDIA_ID);
    process.exit(1);
  }
  const stepId = renderStep[0].id;

  const assets = await AppDataSource.query(
    `SELECT type, blob_storage_id FROM media_assets WHERE media_id = $1 ORDER BY type, created_at`,
    [MEDIA_ID]
  );
  const audio = assets.find((a: any) => a.type === 'audio')?.blob_storage_id;
  const caption = assets.find((a: any) => a.type === 'caption')?.blob_storage_id;
  const images = assets.filter((a: any) => a.type === 'image').map((a: any) => a.blob_storage_id);

  if (!audio || !caption || !images.length) {
    console.error('Missing assets: audio=%s caption=%s images=%d', !!audio, !!caption, images.length);
    process.exit(1);
  }

  let musicBlobId: string | undefined;
  const musicId = (inputConfig as any)?.music?.id;
  if (musicId) {
    const music = await AppDataSource.query(
      'SELECT blob_storage_id FROM background_music WHERE id = $1',
      [musicId]
    );
    if (music[0]) musicBlobId = music[0].blob_storage_id;
  }

  // Reset render step so worker can update it on success
  await AppDataSource.query(
    `UPDATE media_steps SET status = 'processing', error_message = NULL, completed_at = NULL WHERE media_id = $1 AND step = 'render'`,
    [MEDIA_ID]
  );
  await AppDataSource.query(
    `UPDATE media SET status = 'processing', error_message = NULL WHERE id = $1`,
    [MEDIA_ID]
  );
  console.log('Reset render step and media to processing');

  const connection = process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : process.env.REDIS_HOST
      ? {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        }
      : null;
  if (!connection) {
    console.error('Set REDIS_URL or REDIS_HOST in .env');
    process.exit(1);
  }

  const queue = new Queue('render-tasks', { connection });
  const payload = {
    mediaId: MEDIA_ID,
    stepId,
    userId: userId as string,
    assets: {
      audio: audio as string,
      caption: caption as string,
      images: images as string[],
      ...(musicBlobId && { music: musicBlobId }),
    },
    options: {
      preset: 'superfast',
      rendering_hints: {
        pacing: 'moderate',
        width: (inputConfig as any)?.aspectRatio === '1:1' ? 1080 : (inputConfig as any)?.aspectRatio === '16:9' ? 1280 : 720,
        height: (inputConfig as any)?.aspectRatio === '1:1' ? 1080 : (inputConfig as any)?.aspectRatio === '16:9' ? 720 : 1280,
      },
    },
  };

  const job = await queue.add('render-video', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  });

  console.log('Job added to render-tasks. Job ID:', job.id);
  await queue.close();
  await AppDataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
