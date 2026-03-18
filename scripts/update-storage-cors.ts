/**
 * Updates the Supabase Storage bucket CORS configuration to allow
 * direct browser uploads from all configured frontend origins.
 *
 * Usage:
 *   npx tsx scripts/update-storage-cors.ts
 *
 * Required env vars (from .env):
 *   SUPABASE_STORAGE_ENDPOINT
 *   SUPABASE_STORAGE_REGION
 *   SUPABASE_STORAGE_ACCESS_KEY_ID
 *   SUPABASE_STORAGE_SECRET_ACCESS_KEY
 *   SUPABASE_STORAGE_BUCKET_NAME
 */

import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ALLOWED_ORIGINS = [
  'https://autoreels.in',
  'https://www.autoreels.in',
  'https://broll-client-portal.vercel.app',
  // Add custom client domains here as needed:
  // 'https://broll.reachdigital.co',
  'http://localhost:3001',
  'http://localhost:3000',
];

async function updateCors() {
  const isSupabase = process.env.CURRENT_BLOB_STORAGE === 'supabase';
  const endpoint = process.env.SUPABASE_STORAGE_ENDPOINT;
  const region = isSupabase
    ? process.env.SUPABASE_STORAGE_REGION || 'us-east-1'
    : process.env.AWS_REGION || 'us-east-1';
  const bucket = isSupabase
    ? process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage'
    : process.env.S3_BUCKET_NAME || 'auto-reels';

  console.log(`🔌 Storage: ${isSupabase ? `Supabase at ${endpoint}` : 'AWS S3'}`);
  console.log(`📦 Bucket: ${bucket}`);
  console.log(`🌐 Allowed origins:\n  ${ALLOWED_ORIGINS.join('\n  ')}`);

  const client = new S3Client(
    isSupabase
      ? {
          region,
          endpoint,
          credentials: {
            accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
          },
          forcePathStyle: true,
        }
      : {
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          },
        },
  );

  // Show current config first
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log('\n📋 Current CORS rules:');
    current.CORSRules?.forEach((rule, i) => {
      console.log(`  Rule ${i + 1}:`);
      console.log(`    Origins: ${rule.AllowedOrigins?.join(', ')}`);
      console.log(`    Methods: ${rule.AllowedMethods?.join(', ')}`);
    });
  } catch {
    console.log('\n⚠️  No existing CORS config (or not supported by this endpoint)');
  }

  // Apply new CORS config
  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: ALLOWED_ORIGINS,
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag', 'Content-Type', 'Content-Length'],
        MaxAgeSeconds: 3600,
      },
    ],
  };

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: corsConfig,
      }),
    );
    console.log('\n✅ CORS configuration updated successfully!');
    console.log('   Browser uploads from broll-client-portal.vercel.app will now work.');
  } catch (error: any) {
    console.error('\n❌ Failed to update CORS via S3 API:', error.message);
    console.log('\n📌 Manual fix required — go to Supabase Dashboard:');
    console.log('   Storage → ai-reels-storage → Configuration → CORS');
    console.log('   Add these origins:');
    ALLOWED_ORIGINS.forEach((o) => console.log(`     ${o}`));
  }
}

updateCors();
