import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectedAccount } from './entities/connected-account.entity';
import { ScheduledPost } from './entities/scheduled-post.entity';
import { UploadLog } from './entities/upload-log.entity';
import { TokenEncryptionService } from './services/token-encryption.service';
import { SocialAuthService } from './services/social-auth.service';
import { SocialPublishService } from './services/social-publish.service';
import { TokenRefreshService } from './services/token-refresh.service';
import { YouTubeService } from './services/youtube.service';
import { TikTokService } from './services/tiktok.service';
import { InstagramService } from './services/instagram.service';
import { SocialPublishQueueService } from './queues/social-publish-queue.service';
import { SocialPublishWorker } from './workers/social-publish.worker';
import { SocialAuthController } from './controllers/social-auth.controller';
import { SocialPublishController } from './controllers/social-publish.controller';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConnectedAccount, ScheduledPost, UploadLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    UserSettingsModule,
    UserNotificationsModule,
  ],
  providers: [
    TokenEncryptionService,
    SocialAuthService,
    SocialPublishService,
    TokenRefreshService,
    YouTubeService,
    TikTokService,
    InstagramService,
    SocialPublishQueueService,
    SocialPublishWorker,
  ],
  controllers: [SocialAuthController, SocialPublishController],
})
export class SocialModule {}
