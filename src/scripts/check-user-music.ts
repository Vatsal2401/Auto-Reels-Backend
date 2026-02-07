import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const USER_ID = '777964c7-2284-4e00-b504-f1bb215a2bec';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [],
});

async function main() {
  await AppDataSource.initialize();
  console.log(`\n🔍 Checking Custom Music for User: ${USER_ID}`);

  const music = await AppDataSource.query(
    `
    SELECT id, name, category, blob_storage_id, created_at, is_system 
    FROM background_music 
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,
    [USER_ID],
  );

  if (music.length === 0) {
    console.log('❌ No custom music found for this user.');
  } else {
    console.log(`✅ Found ${music.length} custom music tracks:`);
    console.table(music);
  }

  await AppDataSource.destroy();
}

main().catch(console.error);
