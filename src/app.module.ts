import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { VideoModule } from './video/video.module';
import { DatabaseModule } from './database/database.module';
import { AIModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { RenderModule } from './render/render.module';
import { AuthModule } from './auth/auth.module';
import { CreditsModule } from './credits/credits.module';
import { HealthModule } from './health/health.module';
import { PaymentModule } from './payment/payment.module';
import { MediaModule } from './media/media.module';
import { ProjectsModule } from './projects/projects.module';
import { KineticTypographyModule } from './kinetic-typography/kinetic-typography.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    NotificationsModule,
    ServeStaticModule.forRoot({
      rootPath: process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'storage'),
      serveRoot: '/storage',
    }),
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
    DatabaseModule,
    VideoModule,
    MediaModule,
    ProjectsModule,
    KineticTypographyModule,
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
