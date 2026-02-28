import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { Redis } from 'ioredis';
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

  private get clientId() { return this.configService.get<string>('YOUTUBE_CLIENT_ID')!; }
  private get clientSecret() { return this.configService.get<string>('YOUTUBE_CLIENT_SECRET')!; }
  private get redirectUri() { return this.configService.get<string>('YOUTUBE_REDIRECT_URI')!; }

  constructor(
    private readonly configService: ConfigService,
    @Inject('SOCIAL_REDIS') private readonly redis: Redis,
    @InjectRepository(ScheduledPost)
    private readonly scheduledPostRepo: Repository<ScheduledPost>,
  ) {}

  generateAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(
    code: string,
  ): Promise<{ access_token: string; refresh_token: string; expiry_date: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`YouTube token exchange failed: ${data.error_description}`);
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: Date.now() + data.expires_in * 1000,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ access_token: string; expiry_date: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`YouTube token refresh failed: ${data.error_description}`);
    return {
      access_token: data.access_token,
      expiry_date: Date.now() + data.expires_in * 1000,
    };
  }

  async getAccountInfo(
    accessToken: string,
  ): Promise<{ channelId: string; channelTitle: string; thumbnailUrl: string }> {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json();
    if (data.error) throw new Error(`YouTube channel info failed: ${data.error.message}`);
    const channel = data.items?.[0];
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
    // Pre-flight quota check (C8)
    const dailyKey = `yt_quota:${new Date().toISOString().slice(0, 10)}`;
    const used = parseInt((await this.redis.get(dailyKey)) ?? '0', 10);
    const dailyLimit = this.configService.get<number>('YOUTUBE_QUOTA_LIMIT') ?? 8000;

    if (used + 1600 > dailyLimit) {
      throw new QuotaExhaustedException(
        `YouTube daily quota limit reached (${used}/10000 units used)`,
      );
    }

    // Step 1: Initiate resumable upload session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(contentLength),
        },
        body: JSON.stringify({
          snippet: {
            title: opts.title,
            description: opts.description ?? '',
            tags: opts.tags ?? [],
            categoryId: opts.categoryId ?? '22',
          },
          status: {
            privacyStatus: opts.privacyStatus ?? 'public',
          },
        }),
      },
    );

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(`YouTube upload init failed: ${JSON.stringify(err)}`);
    }

    const uploadUri = initRes.headers.get('Location');
    if (!uploadUri) throw new Error('YouTube did not return an upload URI');

    // Step 2: Upload the video stream
    const uploadRes = await fetch(uploadUri, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(contentLength),
      },
      body: videoStream as any,
      // @ts-ignore — Node.js 18+ fetch requires duplex for streaming bodies
      duplex: 'half',
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({})) as any;
      if (uploadRes.status === 403 && err?.error?.errors?.[0]?.reason === 'quotaExceeded') {
        throw new QuotaRetryTomorrowError(err.error.message);
      }
      throw new Error(`YouTube upload failed (${uploadRes.status}): ${JSON.stringify(err)}`);
    }

    const data = await uploadRes.json() as any;

    // Deduct quota units
    await this.redis.incrby(dailyKey, 1600);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    await this.redis.expireat(dailyKey, Math.floor(tomorrow.getTime() / 1000));

    // Update upload progress
    await this.scheduledPostRepo
      .update(postId, { upload_progress_pct: 100 })
      .catch(() => {});

    const videoId: string = data.id;
    return {
      platformPostId: videoId,
      platformUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }
}
