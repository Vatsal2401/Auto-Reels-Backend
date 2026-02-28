import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';
import { ConnectedAccount, SocialPlatform } from '../entities/connected-account.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { YouTubeService } from './youtube.service';
import { TikTokService } from './tiktok.service';
import { InstagramService } from './instagram.service';

@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  // Refresh windows per platform
  private readonly YOUTUBE_THRESHOLD_MS   = 60 * 60 * 1000;            // 1 hour
  private readonly TIKTOK_THRESHOLD_MS    = 60 * 60 * 1000;            // 1 hour
  private readonly INSTAGRAM_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000; // 10 days (C1)

  constructor(
    @InjectRepository(ConnectedAccount)
    private readonly connectedAccountRepo: Repository<ConnectedAccount>,
    @Inject('SOCIAL_REDIS') private readonly redis: Redis,
    private readonly enc: TokenEncryptionService,
    private readonly youtubeService: YouTubeService,
    private readonly tiktokService: TikTokService,
    private readonly instagramService: InstagramService,
  ) {}

  async refreshAccount(account: ConnectedAccount): Promise<void> {
    const lockKey = `token_refresh_lock:${account.id}`;
    const lockTtl = 30_000; // 30s max (C2)
    const lockVal = crypto.randomUUID();

    // Atomic lock acquire — SET NX PX (C2)
    const acquired = await this.redis.set(lockKey, lockVal, 'PX', lockTtl, 'NX');
    if (!acquired) {
      await new Promise((r) => setTimeout(r, 2000));
      return;
    }

    try {
      // Re-read from DB inside the lock to avoid double-refresh
      const fresh = await this.connectedAccountRepo.findOneBy({ id: account.id });
      if (!fresh || !this.isExpiringSoon(fresh)) return;

      let newAccessEnc: string;
      let newRefreshEnc: string | null = fresh.refresh_token_enc;
      let newExpiry: Date;

      switch (fresh.platform) {
        case SocialPlatform.YOUTUBE: {
          if (!fresh.refresh_token_enc) {
            await this.markNeedsReauth(fresh.id, 'No refresh token stored');
            return;
          }
          const currentRefresh = this.enc.decrypt(fresh.refresh_token_enc);
          const tokens = await this.youtubeService.refreshAccessToken(currentRefresh);
          newAccessEnc = this.enc.encrypt(tokens.access_token);
          newExpiry = new Date(tokens.expiry_date);
          break;
        }
        case SocialPlatform.TIKTOK: {
          if (!fresh.refresh_token_enc) {
            await this.markNeedsReauth(fresh.id, 'No refresh token stored');
            return;
          }
          const currentRefresh = this.enc.decrypt(fresh.refresh_token_enc);
          const tokens = await this.tiktokService.refreshAccessToken(currentRefresh);
          newAccessEnc = this.enc.encrypt(tokens.access_token);
          newRefreshEnc = this.enc.encrypt(tokens.refresh_token);
          newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
          break;
        }
        case SocialPlatform.INSTAGRAM: {
          // Instagram: refresh the long-lived token using the access_token itself (C1)
          const currentAccess = this.enc.decrypt(fresh.access_token_enc);
          const tokens = await this.instagramService.refreshLongLivedToken(currentAccess);
          newAccessEnc = this.enc.encrypt(tokens.access_token);
          newRefreshEnc = null; // Instagram has no refresh_token
          newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
          break;
        }
        default:
          throw new Error(`Unknown platform: ${(fresh as any).platform}`);
      }

      await this.connectedAccountRepo.update(fresh.id, {
        access_token_enc: newAccessEnc,
        refresh_token_enc: newRefreshEnc,
        token_expires_at: newExpiry,
        needs_reauth: false,
      });
      this.logger.log(`Token refreshed for account ${fresh.id} (${fresh.platform})`);
    } catch (err: any) {
      this.logger.error(`Token refresh failed for account ${account.id}: ${err.message}`);
      await this.markNeedsReauth(account.id, err.message);
    } finally {
      // Release lock only if we still own it — atomic Lua script (C2)
      const releaseLua = `if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`;
      await this.redis.eval(releaseLua, 1, lockKey, lockVal);
    }
  }

  async findExpiringSoon(): Promise<ConnectedAccount[]> {
    const now = Date.now();
    return this.connectedAccountRepo
      .createQueryBuilder('a')
      .where('a.is_active = true AND a.needs_reauth = false')
      .andWhere(
        `(a.platform != 'instagram' AND a.token_expires_at < :std) OR ` +
          `(a.platform = 'instagram' AND a.token_expires_at < :ig)`,
        {
          std: new Date(now + this.YOUTUBE_THRESHOLD_MS),
          ig:  new Date(now + this.INSTAGRAM_THRESHOLD_MS),
        },
      )
      .getMany();
  }

  isExpiringSoon(account: ConnectedAccount): boolean {
    if (!account.token_expires_at) return false;
    const threshold =
      account.platform === SocialPlatform.INSTAGRAM
        ? this.INSTAGRAM_THRESHOLD_MS
        : account.platform === SocialPlatform.TIKTOK
          ? this.TIKTOK_THRESHOLD_MS
          : this.YOUTUBE_THRESHOLD_MS;
    return account.token_expires_at.getTime() - Date.now() < threshold;
  }

  private async markNeedsReauth(accountId: string, reason: string): Promise<void> {
    await this.connectedAccountRepo.update(accountId, { needs_reauth: true });
    this.logger.warn(`Account ${accountId} marked needs_reauth: ${reason}`);
  }
}
