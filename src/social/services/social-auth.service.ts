import { Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';
import { ConnectedAccount, SocialPlatform } from '../entities/connected-account.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { YouTubeService } from './youtube.service';
import { TikTokService } from './tiktok.service';
import { InstagramService } from './instagram.service';

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    @InjectRepository(ConnectedAccount)
    private readonly connectedAccountRepo: Repository<ConnectedAccount>,
    @Inject('SOCIAL_REDIS') private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly enc: TokenEncryptionService,
    private readonly youtubeService: YouTubeService,
    private readonly tiktokService: TikTokService,
    private readonly instagramService: InstagramService,
  ) {}

  // ─── YouTube ────────────────────────────────────────────────────────────────

  generateYouTubeAuthUrl(userId: string): string {
    const state = this.jwtService.sign(
      { userId, platform: 'youtube', nonce: crypto.randomUUID() },
      { expiresIn: '10m' },
    );
    return `${this.youtubeService.generateAuthUrl()}&state=${state}`;
  }

  async handleYouTubeCallback(code: string, state: string): Promise<ConnectedAccount> {
    const payload = this.jwtService.verify<{ userId: string; platform: string }>(state);
    if (payload.platform !== 'youtube') throw new UnauthorizedException('Invalid state platform');

    const tokens = await this.youtubeService.exchangeCode(code);
    const info = await this.youtubeService.getAccountInfo(tokens.access_token);

    return this.upsertAccount({
      userId: payload.userId,
      platform: SocialPlatform.YOUTUBE,
      platformAccountId: info.channelId,
      accountName: info.channelTitle,
      accountAvatarUrl: info.thumbnailUrl,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(tokens.expiry_date),
      tokenType: null,
    });
  }

  // ─── TikTok ─────────────────────────────────────────────────────────────────

  async generateTikTokAuthUrl(userId: string): Promise<string> {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = this.jwtService.sign(
      { userId, platform: 'tiktok', nonce: crypto.randomUUID() },
      { expiresIn: '10m' },
    );

    // Store code_verifier in Redis (5min TTL, keyed by state) — PKCE (H5)
    await this.redis.set(`pkce:${state}`, codeVerifier, 'EX', 600);
    return this.tiktokService.generateAuthUrl(codeChallenge, state);
  }

  async handleTikTokCallback(code: string, state: string): Promise<ConnectedAccount> {
    const payload = this.jwtService.verify<{ userId: string; platform: string }>(state);
    if (payload.platform !== 'tiktok') throw new UnauthorizedException('Invalid state platform');

    const codeVerifier = await this.redis.get(`pkce:${state}`);
    if (!codeVerifier) throw new UnauthorizedException('PKCE state expired or invalid');
    await this.redis.del(`pkce:${state}`);

    const tokens = await this.tiktokService.exchangeCode(code, codeVerifier);
    const info = await this.tiktokService.getAccountInfo(tokens.access_token);

    return this.upsertAccount({
      userId: payload.userId,
      platform: SocialPlatform.TIKTOK,
      platformAccountId: tokens.open_id,
      accountName: info.displayName,
      accountAvatarUrl: info.avatarUrl,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      tokenType: null,
    });
  }

  // ─── Instagram ──────────────────────────────────────────────────────────────

  generateInstagramAuthUrl(userId: string): string {
    const state = this.jwtService.sign(
      { userId, platform: 'instagram', nonce: crypto.randomUUID() },
      { expiresIn: '10m' },
    );
    return this.instagramService.generateAuthUrl(state);
  }

  async handleInstagramCallback(code: string, state: string): Promise<ConnectedAccount> {
    const payload = this.jwtService.verify<{ userId: string; platform: string }>(state);
    if (payload.platform !== 'instagram') throw new UnauthorizedException('Invalid state platform');

    // Step 1: Exchange code for short-lived token (1 hour)
    const shortLived = await this.instagramService.exchangeCodeForShortLived(code);

    // Step 2: Exchange short-lived for long-lived token (60 days) — (C1)
    const longLived = await this.instagramService.exchangeForLongLived(shortLived.access_token);

    const info = await this.instagramService.getAccountInfo(longLived.access_token);

    return this.upsertAccount({
      userId: payload.userId,
      platform: SocialPlatform.INSTAGRAM,
      platformAccountId: info.userId,
      accountName: info.username,
      accountAvatarUrl: info.profilePictureUrl,
      accessToken: longLived.access_token,
      refreshToken: null, // Instagram has no refresh_token (C1)
      tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      tokenType: 'long_lived',
    });
  }

  // ─── Shared ─────────────────────────────────────────────────────────────────

  async listAccounts(userId: string): Promise<ConnectedAccount[]> {
    return this.connectedAccountRepo.findBy({ user_id: userId, is_active: true });
  }

  async disconnectAccount(userId: string, accountId: string): Promise<void> {
    await this.connectedAccountRepo.update(
      { id: accountId, user_id: userId },
      { is_active: false },
    );
  }

  private async upsertAccount(params: {
    userId: string;
    platform: SocialPlatform;
    platformAccountId: string;
    accountName: string;
    accountAvatarUrl: string;
    accessToken: string;
    refreshToken: string | null;
    tokenExpiresAt: Date;
    tokenType: string | null;
  }): Promise<ConnectedAccount> {
    const existing = await this.connectedAccountRepo.findOne({
      where: {
        user_id: params.userId,
        platform: params.platform,
        platform_account_id: params.platformAccountId,
      },
    });

    const data = {
      user_id: params.userId,
      platform: params.platform,
      platform_account_id: params.platformAccountId,
      account_name: params.accountName,
      account_avatar_url: params.accountAvatarUrl,
      access_token_enc: this.enc.encrypt(params.accessToken),
      refresh_token_enc: params.refreshToken ? this.enc.encrypt(params.refreshToken) : null,
      token_expires_at: params.tokenExpiresAt,
      token_type: params.tokenType,
      is_active: true,
      needs_reauth: false,
    };

    if (existing) {
      await this.connectedAccountRepo.update(existing.id, data);
      return { ...existing, ...data } as ConnectedAccount;
    }

    return this.connectedAccountRepo.save(this.connectedAccountRepo.create(data));
  }
}
