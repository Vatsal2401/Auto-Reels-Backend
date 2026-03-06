import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const email = 'vatsal5176@gmail.com';

async function enableStoryReel() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ai_reels',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find user
    const userResult = await client.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }
    const user = userResult.rows[0];
    console.log(`Found user: ${user.email} (id: ${user.id})`);

    // Check current value
    const before = await client.query(
      'SELECT story_reel_enabled FROM user_settings WHERE user_id = $1',
      [user.id],
    );
    if (before.rowCount === 0) {
      console.error(`No user_settings row found for user: ${email}`);
      process.exit(1);
    }
    console.log(`story_reel_enabled before: ${before.rows[0].story_reel_enabled}`);

    // Enable it
    await client.query(
      'UPDATE user_settings SET story_reel_enabled = true WHERE user_id = $1',
      [user.id],
    );
    console.log(`story_reel_enabled after:  true`);
    console.log(`Done — story reel enabled for ${email}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

enableStoryReel();
