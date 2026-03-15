import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DownloadResult {
  downloadUrl: string;
  filename: string;
  quality: string;
}

/** Candidate binary locations checked in order */
const YT_DLP_CANDIDATES = [
  'yt-dlp',                          // in PATH (Docker / apt install)
  '/usr/local/bin/yt-dlp',           // common Docker location
  '/usr/bin/yt-dlp',
  '/home/deploy/.local/bin/yt-dlp',  // deploy user pip install
  '/home/vatsal2401/.local/bin/yt-dlp', // dev machine pip install
];

@Injectable()
export class InstagramDownloaderService {
  private readonly logger = new Logger(InstagramDownloaderService.name);
  private ytDlpBin: string | null = null;

  async fetchDownloadLink(instagramUrl: string): Promise<DownloadResult> {
    const bin = await this.resolveYtDlp();
    if (!bin) {
      this.logger.error('yt-dlp binary not found — install with: pip3 install yt-dlp');
      throw new BadRequestException(
        'Video downloader is not configured on this server. Please contact support.',
      );
    }

    const shortcode = this.extractShortcode(instagramUrl);

    try {
      const { stdout } = await execAsync(
        `"${bin}" -J --no-download --no-warnings "${instagramUrl}"`,
        { timeout: 30_000 },
      );

      const info = JSON.parse(stdout);

      // Pick best single-file mp4 format (not DASH segment)
      const formats: Record<string, unknown>[] = Array.isArray(info.formats)
        ? (info.formats as Record<string, unknown>[])
        : [];

      const singleMp4 = formats
        .filter(
          (f) =>
            f['ext'] === 'mp4' &&
            f['url'] &&
            typeof f['url'] === 'string' &&
            !(f['format_id'] as string | undefined)?.startsWith('dash') &&
            f['vcodec'] !== 'none',
        )
        .sort(
          (a, b) =>
            ((b['height'] as number) || 0) - ((a['height'] as number) || 0),
        );

      // Fall back to any format with a direct video URL if no clean mp4
      const best =
        singleMp4[0] ??
        formats.find(
          (f) =>
            f['url'] &&
            typeof f['url'] === 'string' &&
            f['vcodec'] !== 'none',
        );

      if (!best?.['url']) {
        throw new BadRequestException(
          'Could not find a downloadable video format. The post may use DRM or be unavailable.',
        );
      }

      const title = (info.title as string | undefined) || `instagram-${shortcode}`;
      const safeTitle = title
        .replace(/[^a-z0-9\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60);
      const filename = `${safeTitle || shortcode}.mp4`;
      const quality = best['height'] ? `${best['height']}p` : 'HD';

      return { downloadUrl: best['url'] as string, filename, quality };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const msg = (err as Error).message ?? '';
      this.logger.warn(`yt-dlp failed for ${instagramUrl}: ${msg.slice(0, 200)}`);

      if (msg.includes('Private') || msg.includes('private') || msg.includes('login')) {
        throw new BadRequestException(
          'This video appears to be private or requires login. Only public posts can be downloaded.',
        );
      }
      throw new BadRequestException(
        'Could not download this video. Please ensure the URL is correct and the post is public.',
      );
    }
  }

  /** Check candidates once and cache the working binary path */
  private async resolveYtDlp(): Promise<string | null> {
    if (this.ytDlpBin !== null) return this.ytDlpBin || null;

    for (const candidate of YT_DLP_CANDIDATES) {
      try {
        await execAsync(`"${candidate}" --version`, { timeout: 5_000 });
        this.ytDlpBin = candidate;
        this.logger.log(`Using yt-dlp at: ${candidate}`);
        return candidate;
      } catch {
        // try next
      }
    }

    this.ytDlpBin = '';  // cache "not found"
    return null;
  }

  private extractShortcode(url: string): string {
    const match = url.match(/instagram\.com\/(?:reel|p|tv|reels)\/([A-Za-z0-9_-]+)/);
    return match?.[1] ?? 'video';
  }
}
