import { Module } from '@nestjs/common';
import { InstagramDownloaderController } from './instagram-downloader.controller';
import { InstagramDownloaderService } from './instagram-downloader.service';

@Module({
  controllers: [InstagramDownloaderController],
  providers: [InstagramDownloaderService],
})
export class InstagramDownloaderModule {}
