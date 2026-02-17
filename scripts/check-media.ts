/**
 * One-off script to inspect a media row in the DB.
 * Run from backend: npx ts-node -r dotenv/config scripts/check-media.ts
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

const MEDIA_ID = process.argv[2] || 'b034bc87-1673-48de-9317-ff08f7ecacb5';

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or DB_* env vars');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  const res = await pool.query(
    `SELECT id, type, flow_key, status, user_id, blob_storage_id, blob_storage_backend, created_at, completed_at
     FROM media WHERE id = $1`,
    [MEDIA_ID],
  );

  if (res.rows.length === 0) {
    console.log('No media row found for id:', MEDIA_ID);
  } else {
    console.log('Media row:');
    console.log(JSON.stringify(res.rows[0], null, 2));
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
