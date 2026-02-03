import { Client } from 'pg';
import 'dotenv/config';

async function fixCompletedMedia() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });

  const mediaId = 'd72008ed-b86d-4bde-ae5f-8e1fced70185';
  const videoBlobId =
    'users/684b85fa-2b31-4479-a3e0-3940ab735f95/media/d72008ed-b86d-4bde-ae5f-8e1fced70185/video/render/final_render.mp4';

  try {
    await client.connect();
    console.log(`Fixing data for media: ${mediaId}`);

    const res = await client.query(
      `
            UPDATE media 
            SET status = 'completed', 
                blob_storage_id = $1, 
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING status, completed_at
        `,
      [videoBlobId, mediaId],
    );

    console.log('Update result:', res.rows[0]);
    console.log('✅ Media status fixed.');
  } catch (err: any) {
    console.error('❌ Failed to fix media status:', err.message);
  } finally {
    await client.end();
  }
}

fixCompletedMedia();
