import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from '../video/entities/video.entity';
import { Job } from '../video/entities/job.entity';
import { Asset } from '../video/entities/asset.entity';
import { User } from '../auth/entities/user.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'ai_reels',
      entities: [Video, Job, Asset, User, CreditTransaction],
      synchronize: process.env.NODE_ENV !== 'production', // NEVER true in production
      logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'schema'] : false,
      retryAttempts: 10,
      retryDelay: 3000,
      autoLoadEntities: true,
      ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require' 
        ? { rejectUnauthorized: process.env.DB_SSL !== 'require' }
        : false,
      extra: {
        max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Connection pool size
        min: parseInt(process.env.DB_POOL_MIN || '5', 10),
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        statement_timeout: 30000, // 30 seconds query timeout
        query_timeout: 30000,
      },
    }),
  ],
})
export class DatabaseModule {}
