import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB per TikTok spec

export interface TikTokUploadOptions {
  title: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface TikTokUploadResult {
  platformPostId: string;
}

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);

  constructor(private readonly configService: ConfigService) {}

  generateAuthUrl(codeChallenge: string, state: string): string {
    const clientKey = this.configService.get('TIKTOK_CLIENT_KEY');
    const redirectUri = encodeURIComponent(this.configService.get('TIKTOK_REDIRECT_URI')!);
    return (
      `https://www.tiktok.com/v2/auth/authorize/?` +
      `client_key=${clientKey}` +
      `&scope=video.publish,user.info.basic` +
      `&response_type=code` +
      `&redirect_uri=${redirectUri}` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`
    );
  }

  async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
    open_id: string;
  }> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.configService.get('TIKTOK_CLIENT_KEY')!,
        client_secret: this.configService.get('TIKTOK_CLIENT_SECRET')!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.configService.get('TIKTOK_REDIRECT_URI')!,
        code_verifier: codeVerifier,
      }),
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(`TikTok token exchange failed: ${data.error_description}`);
    }
    return data;
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_expires_in: number;
  }> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.configService.get('TIKTOK_CLIENT_KEY')!,
        client_secret: this.configService.get('TIKTOK_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(`TikTok token refresh failed: ${data.error_description}`);
    }
    return data;
  }

  async getAccountInfo(
    accessToken: string,
  ): Promise<{ openId: string; displayName: string; avatarUrl: string }> {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json();
    const user = data.data?.user ?? {};
    return { openId: user.open_id, displayName: user.display_name, avatarUrl: user.avatar_url };
  }

  async uploadVideo(
    accessToken: string,
    videoBuffer: Buffer,
    opts: TikTokUploadOptions,
  ): Promise<TikTokUploadResult> {
    const totalSize = videoBuffer.length;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    // Init upload
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: opts.title,
          privacy_level: opts.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
          disable_comment: opts.disableComment ?? false,
          disable_duet: opts.disableDuet ?? false,
          disable_stitch: opts.disableStitch ?? false,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: totalSize,
          chunk_size: CHUNK_SIZE,
          total_chunk_count: totalChunks,
        },
      }),
    });
    const initData = await initRes.json();
    if (initData.error?.code !== 'ok') {
      throw new Error(`TikTok init upload failed: ${JSON.stringify(initData.error)}`);
    }

    const { publish_id, upload_url } = initData.data;

    // Upload chunks sequentially with Content-Range
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize) - 1;
      const chunk = videoBuffer.subarray(start, end + 1);

      const chunkRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(chunk.length),
        },
        body: new Uint8Array(chunk),
      });

      if (!chunkRes.ok) {
        throw new Error(
          `TikTok chunk ${i + 1}/${totalChunks} upload failed: ${chunkRes.status}`,
        );
      }
    }

    return this.pollPublishStatus(accessToken, publish_id);
  }

  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
  ): Promise<TikTokUploadResult> {
    const maxAttempts = 30; // 5 minutes max (10s intervals)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 10_000));

      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const data = await res.json();
      const status = data.data?.status;

      if (status === 'PUBLISH_COMPLETE') {
        return { platformPostId: data.data.publicaly_available_post_id?.[0] ?? publishId };
      }
      if (status === 'FAILED') {
        throw new Error(`TikTok publish failed: ${JSON.stringify(data.data?.fail_reason)}`);
      }
    }
    throw new Error('TikTok publish timed out after 5 minutes of polling');
  }
}
