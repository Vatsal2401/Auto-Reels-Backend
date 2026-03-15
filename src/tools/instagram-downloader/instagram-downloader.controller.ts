import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
  HttpCode,
  Res,
} from '@nestjs/common';
import { IsUrl } from 'class-validator';
import { Response } from 'express';
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

  /**
   * GET /tools/instagram-downloader/proxy-download?cdnUrl=...&filename=...
   * Proxies the Instagram CDN video through our server so the browser
   * triggers a direct file download (Content-Disposition: attachment).
   */
  @Get('proxy-download')
  async proxyDownload(
    @Query('cdnUrl') cdnUrl: string,
    @Query('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!cdnUrl || !cdnUrl.startsWith('https://')) {
      throw new BadRequestException('Invalid cdn URL');
    }

    // Only allow Instagram/Facebook CDN URLs
    const allowed = ['cdninstagram.com', 'fbcdn.net', 'fbsbx.com'];
    const isAllowed = allowed.some((domain) => cdnUrl.includes(domain));
    if (!isAllowed) {
      throw new BadRequestException('URL not from allowed CDN');
    }

    const safeFilename = (filename || 'instagram-video.mp4')
      .replace(/[^a-z0-9._-]/gi, '-')
      .slice(0, 100);

    const upstream = await fetch(cdnUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Referer: 'https://www.instagram.com/',
      },
    });

    if (!upstream.ok) {
      throw new BadRequestException('Could not fetch video from CDN');
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'no-store');

    // Stream body directly to response
    const reader = upstream.body!.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };

    await pump();
  }
}
