import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigService } from '@nestjs/config';

const execAsync = promisify(exec);

export interface DownloadResult {
  downloadUrl: string;
  filename: string;
  quality: string;
}

/** Candidate binary locations checked in order */
const YT_DLP_CANDIDATES = [
  'yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  '/home/deploy/.local/bin/yt-dlp',
  '/home/vatsal2401/.local/bin/yt-dlp',
];

@Injectable()
export class InstagramDownloaderService {
  private readonly logger = new Logger(InstagramDownloaderService.name);
  private ytDlpBin: string | null = null;
  private proxyList: string[] = [];
  private proxyIndex = 0;

  constructor(private readonly configService: ConfigService) {
    this.loadProxies();
  }

  /**
   * Load proxies from env var IG_PROXY_LIST.
   * Format: comma-separated list of  host:port:user:pass
   * e.g. "1.2.3.4:8080:user:pass,5.6.7.8:8080:user:pass"
   */
  private loadProxies(): void {
    const raw = this.configService.get<string>('IG_PROXY_LIST', '');
    if (!raw?.trim()) return;

    this.proxyList = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((entry) => {
        // Convert "host:port:user:pass" → "http://user:pass@host:port"
        const parts = entry.split(':');
        if (parts.length === 4) {
          const [host, port, user, pass] = parts;
          return `http://${user}:${pass}@${host}:${port}`;
        }
        // Already in URL format
        return entry;
      });

    this.logger.log(`Loaded ${this.proxyList.length} proxies`);
  }

  /** Round-robin proxy selection */
  private nextProxy(): string | null {
    if (!this.proxyList.length) return null;
    const proxy = this.proxyList[this.proxyIndex % this.proxyList.length]!;
    this.proxyIndex++;
    return proxy;
  }

  async fetchDownloadLink(instagramUrl: string): Promise<DownloadResult> {
    const bin = await this.resolveYtDlp();
    if (!bin) {
      this.logger.error('yt-dlp binary not found');
      throw new BadRequestException(
        'Video downloader is not configured. Please contact support.',
      );
    }

    const shortcode = this.extractShortcode(instagramUrl);

    // Try up to 3 proxies before giving up
    const maxAttempts = Math.min(3, Math.max(1, this.proxyList.length));
    let lastError = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const proxy = this.nextProxy();
      try {
        const result = await this.runYtDlp(bin, instagramUrl, shortcode, proxy);
        if (attempt > 0 || proxy) {
          this.logger.log(`[instagram-downloader] success via proxy attempt ${attempt + 1}`);
        }
        return result;
      } catch (err) {
        lastError = (err as Error).message ?? '';
        this.logger.warn(
          `[instagram-downloader] attempt ${attempt + 1} failed (proxy: ${proxy ?? 'none'}): ${lastError.slice(0, 120)}`,
        );

        // Don't retry on permanent errors (private/deleted post)
        if (
          lastError.includes('not available') &&
          !lastError.includes('rate') &&
          !lastError.includes('login')
        ) {
          throw new BadRequestException(
            'This video is not available. It may have been deleted.',
          );
        }
      }
    }

    // All attempts failed
    if (lastError.includes('private') || lastError.includes('login') || lastError.includes('Private')) {
      throw new BadRequestException(
        'Could not access this video. Please ensure the post is public.',
      );
    }
    throw new BadRequestException(
      'Could not download this video. Please try again later.',
    );
  }

  private async runYtDlp(
    bin: string,
    url: string,
    shortcode: string,
    proxy: string | null,
  ): Promise<DownloadResult> {
    const proxyFlag = proxy ? `--proxy "${proxy}"` : '';
    const cmd = `"${bin}" -J --no-download --no-warnings ${proxyFlag} "${url}"`;

    const { stdout } = await execAsync(cmd, { timeout: 30_000 });
    const info = JSON.parse(stdout);

    const formats: Record<string, unknown>[] = Array.isArray(info.formats)
      ? (info.formats as Record<string, unknown>[])
      : [];

    // Best single-file mp4 (non-DASH, has video stream)
    const best = formats
      .filter(
        (f) =>
          f['ext'] === 'mp4' &&
          f['url'] &&
          typeof f['url'] === 'string' &&
          f['vcodec'] !== 'none' &&
          !(f['format_id'] as string | undefined)?.startsWith('dash'),
      )
      .sort((a, b) => ((b['height'] as number) || 0) - ((a['height'] as number) || 0))[0]
      // fallback: any format with a video URL
      ?? formats.find(
        (f) => f['url'] && typeof f['url'] === 'string' && f['vcodec'] !== 'none',
      );

    if (!best?.['url']) {
      throw new Error('No downloadable video format found');
    }

    const title = (info.title as string | undefined) || `instagram-${shortcode}`;
    const safeTitle = title
      .replace(/[^a-z0-9\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);

    return {
      downloadUrl: best['url'] as string,
      filename: `${safeTitle || shortcode}.mp4`,
      quality: best['height'] ? `${best['height']}p` : 'HD',
    };
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

    this.ytDlpBin = '';
    return null;
  }

  private extractShortcode(url: string): string {
    const match = url.match(/instagram\.com\/(?:reel|p|tv|reels)\/([A-Za-z0-9_-]+)/);
    return match?.[1] ?? 'video';
  }
}
