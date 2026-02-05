import { Client } from 'pg';
import 'dotenv/config';

async function check() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USERNAME}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const mediaId = 'bd6cec91-eef0-43ba-aa2a-d535c94dacb8';

  const res = await client.query('SELECT * FROM media WHERE id = $1', [mediaId]);

  if (res.rows.length === 0) {
    console.log('No media found');
  } else {
    console.log('Media:', JSON.stringify(res.rows[0], null, 2));

    const assets = await client.query('SELECT * FROM media_assets WHERE media_id = $1', [mediaId]);
    console.log('Assets:', JSON.stringify(assets.rows, null, 2));
  }
  await client.end();
}
check().catch(console.error);
