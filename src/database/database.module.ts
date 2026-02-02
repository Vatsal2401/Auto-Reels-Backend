import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Video } from '../video/entities/video.entity';
import { Job } from '../video/entities/job.entity';
import { Asset } from '../video/entities/asset.entity';
import { User } from '../auth/entities/user.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USERNAME') || 'postgres',
        password: configService.get<string>('DB_PASSWORD') || 'postgres',
        database: configService.get<string>('DB_DATABASE') || 'ai_reels',
        entities: [Video, Job, Asset, User, CreditTransaction],
        synchronize: false,
        logging:
          configService.get<string>('NODE_ENV') === 'development'
            ? ['error', 'warn', 'schema']
            : false,
        retryAttempts: 10,
        retryDelay: 3000,
        autoLoadEntities: true,
        ssl:
          configService.get<string>('DB_SSL') === 'true' ||
          configService.get<string>('DB_SSL') === 'require'
            ? { rejectUnauthorized: false }
            : false,
        extra: {
          max: parseInt(configService.get<string>('DB_POOL_MAX') || '20', 10),
          min: parseInt(configService.get<string>('DB_POOL_MIN') || '5', 10),
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
          statement_timeout: 30000,
          query_timeout: 30000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}
