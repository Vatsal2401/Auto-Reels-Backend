import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InstagramUploadOptions {
  caption?: string;
  shareToFeed?: boolean;
}

export interface InstagramUploadResult {
  platformPostId: string;
  platformUrl: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly graphBaseUrl = 'https://graph.instagram.com';

  constructor(private readonly configService: ConfigService) {}

  generateAuthUrl(state: string): string {
    const clientId = this.configService.get('INSTAGRAM_CLIENT_ID');
    const redirectUri = encodeURIComponent(this.configService.get('INSTAGRAM_REDIRECT_URI')!);
    return (
      `https://api.instagram.com/oauth/authorize?` +
      `client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=instagram_basic,instagram_content_publish,pages_read_engagement` +
      `&response_type=code` +
      `&state=${state}`
    );
  }

  async exchangeCodeForShortLived(
    code: string,
  ): Promise<{ access_token: string; user_id: string }> {
    const body = new URLSearchParams({
      client_id: this.configService.get('INSTAGRAM_CLIENT_ID')!,
      client_secret: this.configService.get('INSTAGRAM_CLIENT_SECRET')!,
      grant_type: 'authorization_code',
      redirect_uri: this.configService.get('INSTAGRAM_REDIRECT_URI')!,
      code,
    });

    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(`Instagram short-lived exchange failed: ${data.error_message}`);
    }
    return data;
  }

  async exchangeForLongLived(
    shortLivedToken: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    const clientSecret = this.configService.get('INSTAGRAM_CLIENT_SECRET');
    const res = await fetch(
      `${this.graphBaseUrl}/access_token` +
        `?grant_type=ig_exchange_token` +
        `&client_secret=${clientSecret}` +
        `&access_token=${shortLivedToken}`,
    );
    const data = await res.json();
    if (data.error) {
      throw new Error(`Instagram long-lived exchange failed: ${data.error.message}`);
    }
    return data;
  }

  async refreshLongLivedToken(
    accessToken: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    const res = await fetch(
      `${this.graphBaseUrl}/refresh_access_token` +
        `?grant_type=ig_refresh_token` +
        `&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.error) {
      throw new Error(`Instagram token refresh failed: ${data.error.message}`);
    }
    return data;
  }

  async getAccountInfo(
    accessToken: string,
  ): Promise<{ userId: string; username: string; profilePictureUrl: string }> {
    const res = await fetch(
      `${this.graphBaseUrl}/me?fields=id,username,profile_picture_url&access_token=${accessToken}`,
    );
    const data = await res.json();
    if (data.error) throw new Error(`Instagram account info failed: ${data.error.message}`);
    return {
      userId: data.id,
      username: data.username,
      profilePictureUrl: data.profile_picture_url ?? '',
    };
  }

  async uploadReel(
    accessToken: string,
    presignedVideoUrl: string,
    userId: string,
    opts: InstagramUploadOptions,
  ): Promise<InstagramUploadResult> {
    // Step 1: Create media container
    const createRes = await fetch(`${this.graphBaseUrl}/${userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: presignedVideoUrl,
        caption: opts.caption ?? '',
        share_to_feed: opts.shareToFeed ?? true,
        access_token: accessToken,
      }),
    });
    const createData = await createRes.json();
    if (createData.error) {
      throw new Error(`Instagram create container failed: ${createData.error.message}`);
    }
    const containerId: string = createData.id;

    // Step 2: Poll until container processing is done
    await this.pollContainerStatus(accessToken, containerId);

    // Step 3: Publish the container
    const publishRes = await fetch(`${this.graphBaseUrl}/${userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });
    const publishData = await publishRes.json();
    if (publishData.error) {
      throw new Error(`Instagram publish failed: ${publishData.error.message}`);
    }

    return {
      platformPostId: publishData.id,
      platformUrl: `https://www.instagram.com/p/${publishData.id}`,
    };
  }

  private async pollContainerStatus(accessToken: string, containerId: string): Promise<void> {
    const maxAttempts = 60; // 10 minutes max (10s intervals)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 10_000));

      const res = await fetch(
        `${this.graphBaseUrl}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
      );
      const data = await res.json();

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        throw new Error(`Instagram container processing failed: ${data.status}`);
      }
    }
    throw new Error('Instagram container processing timed out after 10 minutes');
  }
}
