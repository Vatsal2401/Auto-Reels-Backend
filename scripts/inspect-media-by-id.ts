/**
 * Inspect a media by ID: media row, steps with error_message, assets.
 * Usage: npx ts-node -r dotenv/config scripts/inspect-media-by-id.ts <mediaId>
 */
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

async function run(mediaId: string) {
  await AppDataSource.initialize();

  const media = await AppDataSource.query('SELECT id, status, flow_key, error_message, blob_storage_id, completed_at, created_at FROM media WHERE id = $1', [mediaId]);
  console.log('\n--- Media ---');
  console.log(JSON.stringify(media[0] ?? null, null, 2));

  const steps = await AppDataSource.query(
    'SELECT id, step, status, blob_storage_id, error_message, completed_at FROM media_steps WHERE media_id = $1 ORDER BY created_at ASC',
    [mediaId]
  );
  console.log('\n--- Steps (with error_message) ---');
  steps.forEach((s: any) => {
    console.log(`[${s.step}] status=${s.status} blob=${s.blob_storage_id ?? 'null'}`);
    if (s.error_message) console.log(`    error_message: ${s.error_message}`);
  });

  await AppDataSource.destroy();
}

const mediaId = process.argv[2];
if (!mediaId) {
  console.error('Usage: npx ts-node -r dotenv/config scripts/inspect-media-by-id.ts <mediaId>');
  process.exit(1);
}
run(mediaId).catch((e) => { console.error(e); process.exit(1); });
