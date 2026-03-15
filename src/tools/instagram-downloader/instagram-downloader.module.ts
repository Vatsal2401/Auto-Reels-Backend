import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InstagramDownloaderController } from './instagram-downloader.controller';
import { InstagramDownloaderService } from './instagram-downloader.service';

@Module({
  imports: [ConfigModule],
  controllers: [InstagramDownloaderController],
  providers: [InstagramDownloaderService],
})
export class InstagramDownloaderModule {}
