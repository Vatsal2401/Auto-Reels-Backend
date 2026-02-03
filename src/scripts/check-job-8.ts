import { Client } from 'pg';
import 'dotenv/config';

async function queryStatus() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const mediaId = 'd72008ed-b86d-4bde-ae5f-8e1fced70185';

  console.log(`Querying status for media: ${mediaId}`);

  const mediaRes = await client.query('SELECT * FROM media WHERE id = $1', [mediaId]);
  console.log('Media Status:', mediaRes.rows);

  if (mediaRes.rows[0]?.user_id) {
    const userRes = await client.query('SELECT credits_balance FROM users WHERE id = $1', [
      mediaRes.rows[0].user_id,
    ]);
    console.log('User Credits:', userRes.rows[0]?.credits_balance);
  }

  const stepsRes = await client.query(
    'SELECT * FROM media_steps WHERE media_id = $1 ORDER BY started_at ASC',
    [mediaId],
  );
  console.log('Media Steps:', stepsRes.rows);

  await client.end();
}

queryStatus().catch(console.error);
