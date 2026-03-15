import { Controller, Post, Body, BadRequestException, HttpCode } from '@nestjs/common';
import { IsUrl } from 'class-validator';
import { InstagramDownloaderService } from './instagram-downloader.service';

class FetchVideoDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;
}

@Controller('tools/instagram-downloader')
export class InstagramDownloaderController {
  constructor(private readonly service: InstagramDownloaderService) {}

  @Post('fetch')
  @HttpCode(200)
  async fetchVideo(@Body() dto: FetchVideoDto) {
    const { url } = dto;

    if (
      !url.includes('instagram.com/reel/') &&
      !url.includes('instagram.com/p/') &&
      !url.includes('instagram.com/tv/') &&
      !url.includes('instagram.com/reels/')
    ) {
      throw new BadRequestException('Please provide a valid Instagram Reel or video URL');
    }

    return this.service.fetchDownloadLink(url);
  }
}
