import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { Video } from '../video/entities/video.entity';
import { Job } from '../video/entities/job.entity';
import { Asset } from '../video/entities/asset.entity';
import { User } from '../auth/entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_reels',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Video, Job, Asset, User],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
