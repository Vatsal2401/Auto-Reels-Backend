import { Client } from 'pg';
import 'dotenv/config';

async function fetchScript() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  try {
    await client.connect();
    const res = await client.query(
      "SELECT metadata FROM media_assets WHERE media_id = '5653a721-639b-4748-b55d-3324408252b6' AND type = 'script' LIMIT 1",
    );
    if (res.rows.length > 0) {
      console.log('--- SCRIPT START ---');
      console.log(res.rows[0].metadata.text);
      console.log('--- SCRIPT END ---');
    } else {
      console.log('❌ Script not found in DB.');
    }
  } catch (e) {
    console.error('❌ DB Error:', e.message);
  } finally {
    await client.end();
  }
}
fetchScript().catch(console.error);
