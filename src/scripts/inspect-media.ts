import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

async function inspectMedia() {
  const mediaId = '61c8686c-5407-40fc-b60c-3707eab4bf74';
  await AppDataSource.initialize();

  console.log('--- Media Details ---');
  const media = await AppDataSource.query('SELECT * FROM media WHERE id = $1;', [mediaId]);
  console.log(JSON.stringify(media, null, 2));

  console.log('\n--- Media Steps ---');
  const steps = await AppDataSource.query(
    'SELECT * FROM media_steps WHERE media_id = $1 ORDER BY created_at ASC;',
    [mediaId],
  );
  console.log(JSON.stringify(steps, null, 2));

  await AppDataSource.destroy();
}

inspectMedia().catch(console.error);
