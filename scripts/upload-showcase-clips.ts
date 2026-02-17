/**
 * Generate 2s clips from showcase_item rows (type reel or graphic_motion),
 * upload to S3 (showcase path per item), and set each row's clip_blob_id.
 *
 * Prerequisites:
 * - Backend .env with DB_* or DATABASE_URL and S3 (or Supabase storage) vars
 * - ffmpeg installed: ffmpeg -i in.mp4 -t 2 -c copy out.mp4
 *
 * Run from backend: npm run upload-showcase-clips
 */

import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { Pool } from 'pg';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

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

function createS3Client(storageType?: 's3' | 'supabase'): { client: S3Client; bucket: string } {
  const type = storageType ?? (process.env.CURRENT_BLOB_STORAGE as 's3' | 'supabase') ?? 's3';
  if (type === 'supabase') {
    const endpoint = process.env.SUPABASE_STORAGE_ENDPOINT;
    const region = process.env.SUPABASE_STORAGE_REGION || 'us-east-1';
    const bucket = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';
    const client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true,
    });
    return { client, bucket };
  }
  const bucket = process.env.S3_BUCKET_NAME || 'ai-reels-storage';
  const client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  return { client, bucket };
}

async function downloadFromS3(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Buffer> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);
  const chunks: Buffer[] = [];
  if (!res.Body) throw new Error(`Empty body for ${key}`);
  for await (const chunk of res.Body as any) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function uploadToS3(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'video/mp4',
    }),
  );
}

function extractClip(inputPath: string, outputPath: string, durationSec = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      ['-y', '-i', inputPath, '-t', String(durationSec), '-c', 'copy', outputPath],
      { stdio: 'pipe' },
    );
    let stderr = '';
    ffmpeg.stderr?.on('data', (d) => { stderr += d.toString(); });
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
    ffmpeg.on('error', reject);
  });
}

const CLIP_DURATION_SEC = 2;

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or DB_* env vars');
    process.exit(1);
  }

  const uploadTarget = (process.env.CURRENT_BLOB_STORAGE as 's3' | 'supabase') || 's3';
  const { client: uploadClient, bucket: uploadBucket } = createS3Client(uploadTarget);
  const pool = new Pool({ connectionString: dbUrl });

  const workDir = join(tmpdir(), 'showcase-clips-' + Date.now());
  mkdirSync(workDir, { recursive: true });

  try {
    const itemsRes = await pool.query(
      `SELECT id, type, media_id, project_id FROM showcase_item
       WHERE type IN ('reel', 'graphic_motion') ORDER BY sort_order ASC`,
    );
    if (itemsRes.rows.length === 0) {
      console.log('No reel or graphic_motion showcase_item rows found.');
      return;
    }

    for (const item of itemsRes.rows) {
      const itemId = item.id;
      const type = item.type;
      let blobKey: string | null = null;

      let downloadClient = uploadClient;
      let downloadBucket = uploadBucket;

      if (type === 'reel' && item.media_id) {
        const mediaRes = await pool.query(
          'SELECT blob_storage_id, blob_storage_backend FROM media WHERE id = $1',
          [item.media_id],
        );
        const mediaRow = mediaRes.rows[0];
        blobKey = mediaRow?.blob_storage_id ?? null;
        const backend = mediaRow?.blob_storage_backend as 's3' | 'supabase' | null;
        if (blobKey && backend === 'supabase') {
          const supabase = createS3Client('supabase');
          downloadClient = supabase.client;
          downloadBucket = supabase.bucket;
        }
      } else if (type === 'graphic_motion' && item.project_id) {
        const projRes = await pool.query(
          'SELECT output_url FROM projects WHERE id = $1',
          [item.project_id],
        );
        blobKey = projRes.rows[0]?.output_url ?? null;
      }

      if (!blobKey) {
        console.warn(`Skip item ${itemId} (${type}): no source video.`);
        continue;
      }

      const clipKey = `users/system/media/showcase/clip/${itemId}.mp4`;
      const fullPath = join(workDir, `${itemId}-full.mp4`);
      const clipPath = join(workDir, `${itemId}-clip.mp4`);

      try {
        console.log(`Downloading ${type} full video for item ${itemId}...`);
        const buf = await downloadFromS3(downloadClient, downloadBucket, blobKey);
        writeFileSync(fullPath, buf);
        console.log('Extracting 2s clip (ffmpeg)...');
        await extractClip(fullPath, clipPath, CLIP_DURATION_SEC);
        const clipBuf = readFileSync(clipPath);
        console.log(`Uploading clip to ${uploadTarget}...`);
        await uploadToS3(uploadClient, uploadBucket, clipKey, clipBuf);
        await pool.query(
          'UPDATE showcase_item SET clip_blob_id = $1, updated_at = NOW() WHERE id = $2',
          [clipKey, itemId],
        );
        console.log('Clip uploaded:', clipKey);
      } catch (err: any) {
        const isNoSuchKey =
          err?.Code === 'NoSuchKey' ||
          err?.name === 'NoSuchKey' ||
          (typeof err?.message === 'string' && err.message.includes('does not exist'));
        if (isNoSuchKey) {
          console.warn(
            `Skip item ${itemId}: source video not found in S3 (key: ${blobKey}). Upload the media video first or fix blob_storage_id.`,
          );
        } else {
          throw err;
        }
      }
    }

    console.log('Done. GET /showcase will now return these clip URLs.');
  } finally {
    try {
      for (const f of readdirSync(workDir)) {
        unlinkSync(join(workDir, f));
      }
      rmSync(workDir, { recursive: true });
    } catch {
      // ignore cleanup
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
