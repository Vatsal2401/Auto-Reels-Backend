import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TARGET_USER_ID = '777964c7-2284-4e00-b504-f1bb215a2bec';

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
  console.log(`\n🛠️  Fixing Anonymous Music for User: ${TARGET_USER_ID}`);

  // 1. Check count before
  const countResult = await AppDataSource.query(`
    SELECT COUNT(*) as count FROM background_music 
    WHERE user_id IS NULL AND is_system = false
  `);
  console.log(`Found ${countResult[0].count} anonymous tracks.`);

  if (parseInt(countResult[0].count) > 0) {
    // 2. Update
    await AppDataSource.query(
      `
      UPDATE background_music 
      SET user_id = $1 
      WHERE user_id IS NULL AND is_system = false
    `,
      [TARGET_USER_ID],
    );

    console.log('✅ Successfully updated tracks to belong to the user.');
  } else {
    console.log('No tracks needed updating.');
  }

  await AppDataSource.destroy();
}

main().catch(console.error);
