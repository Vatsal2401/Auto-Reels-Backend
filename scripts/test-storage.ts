import { S3Client, PutObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testStorage() {
  console.log('🧪 Testing Supabase Storage Connectivity...');
  console.log(`Endpoint: ${process.env.SUPABASE_STORAGE_ENDPOINT}`);
  console.log(`Region: ${process.env.SUPABASE_STORAGE_REGION}`);
  console.log(`Bucket: ${process.env.SUPABASE_STORAGE_BUCKET_NAME}`);

  const client = new S3Client({
    region: process.env.SUPABASE_STORAGE_REGION,
    endpoint: process.env.SUPABASE_STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.SUPABASE_STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
  });

  const bucketName = process.env.SUPABASE_STORAGE_BUCKET_NAME || 'ai-reels-storage';
  const testKey = `test-upload-${Date.now()}.txt`;

  try {
    console.log('📂 Listing buckets/objects to verify auth...');
    // Note: ListBuckets might not be supported or restricted, so we verify by listing objects in the specific bucket
    const listCmd = new ListObjectsCommand({ Bucket: bucketName, MaxKeys: 1 });
    await client.send(listCmd);
    console.log('✅ Auth successful. Bucket is accessible.');

    console.log(`⬆️ Uploading test file: ${testKey}...`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: 'Hello Supabase Storage! This is a test file.',
        ContentType: 'text/plain',
      }),
    );
    console.log('✅ Upload successful!');
    console.log(`🔗 URL: ${process.env.SUPABASE_STORAGE_ENDPOINT}/${bucketName}/${testKey}`);
  } catch (error: any) {
    console.error('❌ Storage Test Failed:', error);
    if (error.name === 'NoSuchBucket') {
      console.error(
        `⚠️ The bucket "${bucketName}" does not exist. Please create it in your Supabase Dashboard > Storage.`,
      );
    }
  }
}

testStorage();
