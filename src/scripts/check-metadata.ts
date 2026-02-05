import { Client } from 'pg';
import 'dotenv/config';

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query(
    "SELECT metadata FROM media_assets WHERE media_id = '5653a721-639b-4748-b55d-3324408252b6' AND type = 'script'",
  );
  console.log(JSON.stringify(res.rows[0].metadata, null, 2));
  await client.end();
}
check().catch(console.error);
