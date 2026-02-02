import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoModule } from './video/video.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { AIModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { RenderModule } from './render/render.module';
import { AuthModule } from './auth/auth.module';
import { CreditsModule } from './credits/credits.module';
import { HealthModule } from './health/health.module';
import { PaymentModule } from './payment/payment.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      expandVariables: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 requests per minute in production
      },
    ]),
    AppConfigModule,
    DatabaseModule,
    VideoModule,
    MediaModule,
    AIModule,
    StorageModule,
    RenderModule,
    AuthModule,
    CreditsModule,
    HealthModule,
    PaymentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
