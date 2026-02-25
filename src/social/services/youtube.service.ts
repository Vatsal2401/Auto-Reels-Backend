import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ScheduledPost } from '../entities/scheduled-post.entity';

export class QuotaExhaustedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExhaustedException';
  }
}

export class QuotaRetryTomorrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaRetryTomorrowError';
  }
}

export interface YouTubeUploadOptions {
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'public' | 'private' | 'unlisted';
  categoryId?: string;
}

export interface UploadResult {
  platformPostId: string;
  platformUrl: string;
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(ScheduledPost)
    private readonly scheduledPostRepo: Repository<ScheduledPost>,
  ) {}

  getOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get('YOUTUBE_CLIENT_ID'),
      this.configService.get('YOUTUBE_CLIENT_SECRET'),
      this.configService.get('YOUTUBE_REDIRECT_URI'),
    );
  }

  generateAuthUrl(): string {
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
    });
  }

  async exchangeCode(
    code: string,
  ): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string; expiry_date: number }> {
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return {
      access_token: credentials.access_token!,
      expiry_date: credentials.expiry_date!,
    };
  }

  async getAccountInfo(
    accessToken: string,
  ): Promise<{ channelId: string; channelTitle: string; thumbnailUrl: string }> {
    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const res = await youtube.channels.list({ part: ['snippet'], mine: true });
    const channel = res.data.items?.[0];
    return {
      channelId: channel?.id ?? '',
      channelTitle: channel?.snippet?.title ?? '',
      thumbnailUrl: channel?.snippet?.thumbnails?.default?.url ?? '',
    };
  }

  async uploadVideo(
    accessToken: string,
    videoStream: Readable,
    contentLength: number,
    opts: YouTubeUploadOptions,
    postId: string,
  ): Promise<UploadResult> {
    // Pre-flight quota check
    const dailyKey = `yt_quota:${new Date().toISOString().slice(0, 10)}`;
    const used = parseInt((await this.redis.get(dailyKey)) ?? '0', 10);
    const dailyLimit = this.configService.get<number>('YOUTUBE_QUOTA_LIMIT') ?? 8000;

    if (used + 1600 > dailyLimit) {
      throw new QuotaExhaustedException(
        `YouTube daily quota limit reached (${used}/10000 units used)`,
      );
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
      const res = await youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: opts.title,
              description: opts.description ?? '',
              tags: opts.tags ?? [],
              categoryId: opts.categoryId ?? '22',
            },
            status: {
              privacyStatus: opts.privacyStatus ?? 'public',
            },
          },
          media: {
            mimeType: 'video/mp4',
            body: videoStream,
          },
        },
        {
          onUploadProgress: (evt: { bytesRead: number }) => {
            const pct = Math.round((evt.bytesRead / contentLength) * 100);
            this.scheduledPostRepo
              .update(postId, { upload_progress_pct: pct })
              .catch(() => {});
          },
        },
      );

      // Deduct quota units
      await this.redis.incrby(dailyKey, 1600);
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      await this.redis.expireat(dailyKey, Math.floor(tomorrow.getTime() / 1000));

      const videoId = res.data.id!;
      return {
        platformPostId: videoId,
        platformUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } catch (err: any) {
      if (err.code === 403 && err.errors?.[0]?.reason === 'quotaExceeded') {
        throw new QuotaRetryTomorrowError(err.message);
      }
      throw err;
    }
  }
}
