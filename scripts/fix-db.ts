import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixDb() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // Drop the conflicting enum if it exists
    // CASCADE will drop columns using it, but since table creation failed, it might be fine.
    // Or if the table exists, we might need to be careful.
    // We'll try dropping the type.

    console.log('Dropping enum credit_transactions_transaction_type_enum...');
    await client.query(
      'DROP TYPE IF EXISTS public.credit_transactions_transaction_type_enum CASCADE',
    );

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixDb();
