/**
 * Generate 1–2s clips from showcase reel/media and graphic-motion project,
 * upload them to S3 (showcase path), and update the showcase row.
 *
 * Prerequisites:
 * - Backend .env with DB_* or DATABASE_URL and S3 (or Supabase storage) vars
 * - ffmpeg installed: ffmpeg -i in.mp4 -t 2 -c copy out.mp4
 *
 * Run from backend: npm run upload-showcase-clips
 * Or: npx ts-node -r dotenv/config scripts/upload-showcase-clips.ts
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

function createS3Client(): { client: S3Client; bucket: string } {
  const storageType = process.env.CURRENT_BLOB_STORAGE || 's3';
  if (storageType === 'supabase') {
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
const SHOWCASE_REEL_KEY = 'users/system/media/showcase/clip/reel.mp4';
const SHOWCASE_GRAPHIC_MOTION_KEY = 'users/system/media/showcase/clip/graphic-motion.mp4';

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or DB_* env vars');
    process.exit(1);
  }

  const { client, bucket } = createS3Client();
  const pool = new Pool({ connectionString: dbUrl });

  const workDir = join(tmpdir(), 'showcase-clips-' + Date.now());
  mkdirSync(workDir, { recursive: true });

  try {
    const showcaseRes = await pool.query(
      'SELECT id, reel_media_id, graphic_motion_project_id FROM showcase ORDER BY created_at ASC LIMIT 1',
    );
    if (showcaseRes.rows.length === 0) {
      console.error('No showcase row found. Run migration and seed first.');
      process.exit(1);
    }
    const showcase = showcaseRes.rows[0];
    const showcaseId = showcase.id;

    if (showcase.reel_media_id) {
      const mediaRes = await pool.query(
        'SELECT blob_storage_id FROM media WHERE id = $1',
        [showcase.reel_media_id],
      );
      const blobKey = mediaRes.rows[0]?.blob_storage_id;
      if (blobKey) {
        console.log('Downloading reel full video...');
        const buf = await downloadFromS3(client, bucket, blobKey);
        const fullPath = join(workDir, 'reel-full.mp4');
        writeFileSync(fullPath, buf);
        const clipPath = join(workDir, 'reel-clip.mp4');
        console.log('Extracting 2s reel clip (ffmpeg)...');
        await extractClip(fullPath, clipPath, CLIP_DURATION_SEC);
        const clipBuf = readFileSync(clipPath);
        console.log('Uploading reel clip to S3...');
        await uploadToS3(client, bucket, SHOWCASE_REEL_KEY, clipBuf);
        await pool.query(
          'UPDATE showcase SET reel_clip_blob_id = $1, updated_at = NOW() WHERE id = $2',
          [SHOWCASE_REEL_KEY, showcaseId],
        );
        console.log('Reel showcase clip uploaded:', SHOWCASE_REEL_KEY);
      } else {
        console.warn('Reel media has no blob_storage_id, skipping reel clip.');
      }
    } else {
      console.warn('No reel_media_id in showcase, skipping reel clip.');
    }

    if (showcase.graphic_motion_project_id) {
      const projRes = await pool.query(
        'SELECT output_url FROM projects WHERE id = $1',
        [showcase.graphic_motion_project_id],
      );
      const blobKey = projRes.rows[0]?.output_url;
      if (blobKey) {
        console.log('Downloading graphic motion full video...');
        const buf = await downloadFromS3(client, bucket, blobKey);
        const fullPath = join(workDir, 'gm-full.mp4');
        writeFileSync(fullPath, buf);
        const clipPath = join(workDir, 'gm-clip.mp4');
        console.log('Extracting 2s graphic motion clip (ffmpeg)...');
        await extractClip(fullPath, clipPath, CLIP_DURATION_SEC);
        const clipBuf = readFileSync(clipPath);
        console.log('Uploading graphic motion clip to S3...');
        await uploadToS3(client, bucket, SHOWCASE_GRAPHIC_MOTION_KEY, clipBuf);
        await pool.query(
          'UPDATE showcase SET graphic_motion_clip_blob_id = $1, updated_at = NOW() WHERE id = $2',
          [SHOWCASE_GRAPHIC_MOTION_KEY, showcaseId],
        );
        console.log('Graphic motion showcase clip uploaded:', SHOWCASE_GRAPHIC_MOTION_KEY);
      } else {
        console.warn('Graphic motion project has no output_url, skipping.');
      }
    } else {
      console.warn('No graphic_motion_project_id in showcase, skipping.');
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
