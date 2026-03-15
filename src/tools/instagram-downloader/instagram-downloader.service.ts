import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface DownloadResult {
  downloadUrl: string;
  filename: string;
  quality: string;
}

@Injectable()
export class InstagramDownloaderService {
  private readonly logger = new Logger(InstagramDownloaderService.name);

  async fetchDownloadLink(instagramUrl: string): Promise<DownloadResult> {
    try {
      // Extract shortcode from the URL for the filename
      const shortcode = this.extractShortcode(instagramUrl);

      // Use Instagram's public embed endpoint to resolve video metadata
      const oembedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(instagramUrl)}&format=json`;
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (!oembedRes.ok) {
        // oEmbed failed — this often means the post is private or has been deleted
        throw new BadRequestException(
          'Could not access this Instagram video. Please make sure the post is public.',
        );
      }

      const meta = await oembedRes.json();
      const title: string = meta?.title || 'instagram-video';

      // Build a direct media URL using Instagram's CDN embed pattern
      // This works for public Reels and videos exposed via the embed endpoint
      const embedPageUrl = `https://www.instagram.com/p/${shortcode}/embed/`;

      // Fetch the embed page HTML to extract the video CDN URL
      const embedRes = await fetch(embedPageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Mobile Safari/537.36',
          Accept: 'text/html',
        },
      });

      if (!embedRes.ok) {
        throw new BadRequestException('Failed to load video details. The post may be private.');
      }

      const html = await embedRes.text();

      // Extract video src from embed page
      const videoUrlMatch =
        html.match(/"video_url"\s*:\s*"([^"]+)"/) ||
        html.match(/src="(https:\/\/[^"]*\.mp4[^"]*)"/) ||
        html.match(/videoUrl":"([^"]+)"/);

      if (!videoUrlMatch) {
        throw new BadRequestException(
          'Could not extract video URL. This post may be private, expired, or not a video.',
        );
      }

      const rawVideoUrl = videoUrlMatch[1]!.replace(/\\u0026/g, '&').replace(/\\/g, '');
      const safeTitle = title
        .replace(/[^a-z0-9\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60);
      const filename = `${safeTitle || shortcode || 'instagram-video'}.mp4`;

      return {
        downloadUrl: rawVideoUrl,
        filename,
        quality: 'HD',
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`Instagram download failed for ${instagramUrl}: ${(err as Error).message}`);
      throw new BadRequestException(
        'Could not download this video. Please check the URL and ensure the post is public.',
      );
    }
  }

  private extractShortcode(url: string): string {
    const match = url.match(/instagram\.com\/(?:reel|p|tv|reels)\/([A-Za-z0-9_-]+)/);
    return match?.[1] ?? 'video';
  }
}
