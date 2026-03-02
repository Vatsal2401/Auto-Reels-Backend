import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { ImageToVideoService } from './image-to-video.service';
import { ImageToVideoController } from './image-to-video.controller';
import { ImageToVideoEnabledGuard } from './guards/image-to-video-enabled.guard';

@Module({
  imports: [ConfigModule, UserSettingsModule],
  providers: [ImageToVideoService, ImageToVideoEnabledGuard],
  controllers: [ImageToVideoController],
})
export class ImageToVideoModule {}
