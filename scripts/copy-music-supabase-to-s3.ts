/**
 * Copy all background music files from Supabase storage to S3.
 * Keeps the same blob_storage_id (object key) so existing DB rows work with S3.
 *
 * Prerequisites: backend/.env with Supabase storage vars and AWS S3 vars.
 * Run from backend: npx ts-node -r dotenv/config scripts/copy-music-supabase-to-s3.ts
 * (Or: node --loader ts-node/esm scripts/copy-music-supabase-to-s3.ts after ensuring dotenv loads .env)
 */

import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { existsSync } from 'fs';

// Load .env: 1) next to script (backend/.env), 2) cwd, 3) cwd/backend
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

import { Pool } from 'pg';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// Backend often uses DB_* instead of DATABASE_URL; build URL if needed
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

const DATABASE_URL = getDatabaseUrl();
const SUPABASE_ENDPOINT = process.env.SUPABASE_STORAGE_ENDPOINT;
const SUPABASE_ACCESS_KEY = process.env.SUPABASE_STORAGE_ACCESS_KEY_ID;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';
const SUPABASE_REGION = process.env.SUPABASE_STORAGE_REGION || 'us-east-1';

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'auto-reels';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

if (
  !DATABASE_URL ||
  !SUPABASE_ENDPOINT ||
  !SUPABASE_ACCESS_KEY ||
  !SUPABASE_SECRET_KEY ||
  !AWS_ACCESS_KEY ||
  !AWS_SECRET_KEY
) {
  console.error(
    'Missing env. Need: DATABASE_URL (or DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE), SUPABASE_STORAGE_*, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.'
  );
  process.exit(1);
}

const supabaseClient = new S3Client({
  region: SUPABASE_REGION,
  endpoint: SUPABASE_ENDPOINT,
  credentials: {
    accessKeyId: SUPABASE_ACCESS_KEY,
    secretAccessKey: SUPABASE_SECRET_KEY,
  },
  forcePathStyle: true,
});

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

async function existsInS3(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
    return true;
  } catch (e: unknown) {
    const code = (e as { name?: string }).name;
    if (code === 'NotFound' || code === '404') return false;
    throw e;
  }
}

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : undefined,
  });

  const result = await pool.query<{ id: string; name: string; blob_storage_id: string }>(
    'SELECT id, name, blob_storage_id FROM background_music ORDER BY created_at ASC'
  );
  const rows = result.rows;
  await pool.end();

  if (rows.length === 0) {
    console.log('No background_music rows found.');
    return;
  }

  console.log(`Found ${rows.length} music track(s). Copying from Supabase (${SUPABASE_BUCKET}) to S3 (${S3_BUCKET})...`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const key = row.blob_storage_id;
    try {
      if (await existsInS3(key)) {
        console.log(`  [skip] ${row.name} (already in S3)`);
        skipped++;
        continue;
      }

      const getRes = await supabaseClient.send(
        new GetObjectCommand({
          Bucket: SUPABASE_BUCKET,
          Key: key,
        })
      );
      const body = getRes.Body;
      if (!body) {
        console.error(`  [fail] ${row.name}: no body from Supabase`);
        failed++;
        continue;
      }
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const contentType = getRes.ContentType || 'audio/mpeg';

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      console.log(`  [ok] ${row.name}`);
      copied++;
    } catch (err) {
      console.error(`  [fail] ${row.name}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\nDone. Copied: ${copied}, Skipped (already in S3): ${skipped}, Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
