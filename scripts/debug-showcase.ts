/**
 * Debug showcase: list showcase_item rows and show which have clip_blob_id.
 * Run from backend: npx ts-node -r dotenv/config scripts/debug-showcase.ts
 */
import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { Pool } from 'pg';

const scriptDir = __dirname;
const envPaths = [
  join(scriptDir, '..', '.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend', '.env'),
];
for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

function getDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_DATABASE;
  if (!host || !user || !password || !database) return undefined;
  const enc = encodeURIComponent;
  return `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${database}`;
}

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or DB_* env vars');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  const res = await pool.query(
    `SELECT id, type, sort_order, media_id, project_id, clip_blob_id, image_url
     FROM showcase_item ORDER BY sort_order ASC`,
  );

  console.log('CURRENT_BLOB_STORAGE (for API signed URLs):', process.env.CURRENT_BLOB_STORAGE ?? '(not set, default s3)');
  console.log('');
  console.log('Showcase items:');
  for (const row of res.rows) {
    const hasClip = Boolean(row.clip_blob_id?.trim());
    console.log({
      id: row.id,
      type: row.type,
      sort_order: row.sort_order,
      media_id: row.media_id ?? null,
      project_id: row.project_id ?? null,
      clip_blob_id: row.clip_blob_id ?? null,
      has_clip: hasClip,
      note: row.type === 'reel' && !hasClip ? '-> No clip: API will return url: null. Run upload-showcase-clips with same storage as API.' : null,
    });
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
