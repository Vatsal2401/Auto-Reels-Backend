import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  SOCIAL_PUBLISH_QUEUE_YOUTUBE,
  SOCIAL_PUBLISH_QUEUE_TIKTOK,
  SOCIAL_PUBLISH_QUEUE_INSTAGRAM,
  PLATFORM_RATE_LIMITS,
} from '../queues/social-publish-queue.constants';
import { SocialPlatform } from '../entities/connected-account.entity';
import { ConnectedAccount } from '../entities/connected-account.entity';
import { ScheduledPost, PostStatus } from '../entities/scheduled-post.entity';
import { UploadLog, LogEvent } from '../entities/upload-log.entity';
import { TokenEncryptionService } from '../services/token-encryption.service';
import { TokenRefreshService } from '../services/token-refresh.service';
import { YouTubeService, QuotaRetryTomorrowError } from '../services/youtube.service';
import { TikTokService } from '../services/tiktok.service';
import { InstagramService } from '../services/instagram.service';
import { UserNotificationsService } from '../../user-notifications/user-notifications.service';
import { UserNotificationType } from '../../user-notifications/entities/user-notification.entity';
import { SocialPublishQueueService } from '../queues/social-publish-queue.service';

function buildRedisConnection(configService: ConfigService) {
  const url = configService.get<string>('REDIS_URL');
  if (url) return { url };
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
  };
}

@Injectable()
export class SocialPublishWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialPublishWorker.name);
  private workers: Worker[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(ScheduledPost)
    private readonly scheduledPostRepo: Repository<ScheduledPost>,
    @InjectRepository(UploadLog)
    private readonly uploadLogRepo: Repository<UploadLog>,
    @InjectRepository(ConnectedAccount)
    private readonly connectedAccountRepo: Repository<ConnectedAccount>,
    private readonly enc: TokenEncryptionService,
    private readonly tokenRefreshService: TokenRefreshService,
    private readonly youtubeService: YouTubeService,
    private readonly tiktokService: TikTokService,
    private readonly instagramService: InstagramService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly queueService: SocialPublishQueueService,
  ) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.configService);
    const concurrency = this.configService.get<number>('SOCIAL_WORKER_CONCURRENCY') ?? 3;

    const platformConfigs: Array<{ queueName: string; platform: SocialPlatform }> = [
      { queueName: SOCIAL_PUBLISH_QUEUE_YOUTUBE,   platform: SocialPlatform.YOUTUBE },
      { queueName: SOCIAL_PUBLISH_QUEUE_TIKTOK,    platform: SocialPlatform.TIKTOK },
      { queueName: SOCIAL_PUBLISH_QUEUE_INSTAGRAM, platform: SocialPlatform.INSTAGRAM },
    ];

    for (const { queueName, platform } of platformConfigs) {
      const worker = new Worker(
        queueName,
        (job: Job) => this.processJob(job, platform),
        {
          connection,
          concurrency,
          limiter: PLATFORM_RATE_LIMITS[platform],
          stalledInterval: 30_000,   // check for stalled jobs every 30s (C6)
          maxStalledCount: 1,        // re-queue if stalled once
          lockDuration: 20 * 60 * 1000, // must exceed job timeout
        },
      );

      // Handle permanently failed jobs (all retries exhausted) (H7)
      worker.on('failed', async (job, err) => {
        if (!job) return;
        const maxAttempts = job.opts.attempts ?? 3;
        if (job.attemptsMade < maxAttempts) return; // still has retries

        const { scheduledPostId } = job.data;
        try {
          const post = await this.scheduledPostRepo.findOneBy({ id: scheduledPostId });
          if (!post) return;

          await this.scheduledPostRepo.update(scheduledPostId, {
            status: PostStatus.FAILED,
            error_message: err.message,
          });

          await this.userNotificationsService.create({
            userId: post.user_id,
            type: UserNotificationType.POST_FAILED,
            title: `Failed to post to ${post.platform}`,
            message: `Could not publish your video — ${err.message.slice(0, 120)}`,
            actionHref: `/social/posts/${scheduledPostId}`,
          });

          await this.log(scheduledPostId, LogEvent.PUBLISH_FAILED, {
            reason: 'max_retries_exhausted',
            error: err.message,
            attempt: job.attemptsMade,
          });
        } catch (notifErr: any) {
          this.logger.error(`Failed to handle job failure notification: ${notifErr.message}`);
        }
      });

      this.workers.push(worker);
      this.logger.log(`Worker started for queue: ${queueName}`);
    }
  }

  async onModuleDestroy() {
    for (const worker of this.workers) {
      await worker.close();
    }
  }

  private async processJob(job: Job, platform: SocialPlatform): Promise<void> {
    const { scheduledPostId } = job.data;
    const startTime = Date.now();

    this.logger.log({
      message: 'Processing publish job',
      platform,
      scheduledPostId,
      attempt: job.attemptsMade + 1,
    });

    // Pessimistic DB lock — only one worker processes a given post (C3)
    let post: ScheduledPost | null = null;
    await this.dataSource.transaction(async (em) => {
      const locked = await em
        .createQueryBuilder(ScheduledPost, 'p')
        .setLock('pessimistic_write_or_fail') // throws if locked → BullMQ retries
        .where('p.id = :id AND p.status IN (:...statuses)', {
          id: scheduledPostId,
          statuses: [PostStatus.PENDING, PostStatus.UPLOADING],
        })
        .getOne();

      if (!locked) return;
      if (locked.platform_post_id) return; // idempotency guard — already uploaded

      await em.update(ScheduledPost, scheduledPostId, { status: PostStatus.UPLOADING });
      post = locked;
    });

    if (!post) {
      this.logger.log(`Post ${scheduledPostId} already handled or locked — skipping`);
      return;
    }

    // Check if cancelled while we were waiting for the lock
    if ((post as ScheduledPost).status === PostStatus.CANCELLED) return;

    // Load connected account
    const account = await this.connectedAccountRepo.findOneBy({
      id: (post as ScheduledPost).connected_account_id,
    });
    if (!account) throw new Error('Connected account not found');

    // Refresh token if expiring soon
    if (this.tokenRefreshService.isExpiringSoon(account)) {
      await this.tokenRefreshService.refreshAccount(account);
      const refreshed = await this.connectedAccountRepo.findOneBy({ id: account.id });
      if (refreshed?.needs_reauth) {
        throw new Error(`Account needs reauth — token refresh failed for ${platform}`);
      }
      if (refreshed) Object.assign(account, refreshed);
    }

    const accessToken = this.enc.decrypt(account.access_token_enc);
    const typedPost = post as ScheduledPost;

    try {
      let platformPostId: string;

      switch (platform) {
        case SocialPlatform.YOUTUBE:
          platformPostId = await this.handleYouTube(typedPost, accessToken, scheduledPostId);
          break;
        case SocialPlatform.TIKTOK:
          platformPostId = await this.handleTikTok(typedPost, accessToken);
          break;
        case SocialPlatform.INSTAGRAM:
          platformPostId = await this.handleInstagram(
            typedPost,
            accessToken,
            account.platform_account_id,
          );
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      await this.scheduledPostRepo.update(scheduledPostId, {
        status: PostStatus.SUCCESS,
        platform_post_id: platformPostId,
        upload_progress_pct: 100,
      });

      await this.userNotificationsService.create({
        userId: typedPost.user_id,
        type: UserNotificationType.POST_SUCCESS,
        title: `Posted to ${platform} successfully`,
        message: typedPost.video_topic
          ? `"${typedPost.video_topic}" is now live!`
          : 'Your video is now live!',
        actionHref: `/social/posts/${scheduledPostId}`,
      });

      await this.log(scheduledPostId, LogEvent.PUBLISH_SUCCESS, {
        platformPostId,
        platform,
        durationMs: Date.now() - startTime,
        attempt: job.attemptsMade + 1,
      });

      this.logger.log({
        message: 'Upload complete',
        platform,
        scheduledPostId,
        platformPostId,
        attempt: job.attemptsMade + 1,
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      // YouTube quota exhausted — reschedule for tomorrow (C8)
      if (err instanceof QuotaRetryTomorrowError) {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 5, 0, 0);
        await this.queueService.reschedulePost(scheduledPostId, platform, tomorrow);
        await this.scheduledPostRepo.update(scheduledPostId, { status: PostStatus.PENDING });
        await this.log(scheduledPostId, LogEvent.QUOTA_EXCEEDED, {
          rescheduledTo: tomorrow.toISOString(),
        });
        return; // Don't throw — don't consume a retry attempt
      }
      throw err; // Other errors: let BullMQ retry
    }
  }

  private async handleYouTube(
    post: ScheduledPost,
    accessToken: string,
    scheduledPostId: string,
  ): Promise<string> {
    const opts = post.publish_options ?? {};
    // Fresh S3 stream per attempt — never reuse (C4)
    const { stream: videoStream, contentLength } = await this.getS3Stream(post.video_s3_key);

    await this.log(scheduledPostId, LogEvent.UPLOAD_STARTED, { platform: 'youtube' });
    const result = await this.youtubeService.uploadVideo(
      accessToken,
      videoStream as any,
      contentLength,
      {
        title: opts.title ?? post.video_topic ?? 'My Video',
        description: opts.description,
        tags: opts.tags,
        privacyStatus: opts.privacyStatus,
      },
      scheduledPostId,
    );
    await this.log(scheduledPostId, LogEvent.UPLOAD_COMPLETE, {
      platformPostId: result.platformPostId,
    });
    return result.platformPostId;
  }

  private async handleTikTok(post: ScheduledPost, accessToken: string): Promise<string> {
    const opts = post.publish_options ?? {};
    // TikTok requires buffer (not stream) for chunked upload with Content-Range (C7)
    const tmpPath = path.join('/tmp', `${crypto.randomUUID()}.mp4`);
    await this.downloadS3ToFile(post.video_s3_key, tmpPath);
    const videoBuffer = await fs.promises.readFile(tmpPath);
    await fs.promises.unlink(tmpPath).catch(() => {});

    await this.log(post.id, LogEvent.UPLOAD_STARTED, { platform: 'tiktok' });
    const result = await this.tiktokService.uploadVideo(accessToken, videoBuffer, {
      title: opts.title ?? post.video_topic ?? 'My Video',
      privacyLevel: opts.privacyLevel,
    });
    await this.log(post.id, LogEvent.UPLOAD_COMPLETE, { publishId: result.platformPostId });
    return result.platformPostId;
  }

  private async handleInstagram(
    post: ScheduledPost,
    accessToken: string,
    igUserId: string,
  ): Promise<string> {
    const opts = post.publish_options ?? {};
    // Instagram requires publicly accessible URL — generate pre-signed URL (H1)
    const presignedUrl = await this.getPresignedUrl(post.video_s3_key);

    await this.log(post.id, LogEvent.UPLOAD_STARTED, { platform: 'instagram' });
    const result = await this.instagramService.uploadReel(accessToken, presignedUrl, igUserId, {
      caption: opts.caption,
      shareToFeed: opts.shareToFeed,
    });
    await this.log(post.id, LogEvent.UPLOAD_COMPLETE, { mediaId: result.platformPostId });
    return result.platformPostId;
  }

  private async getS3Stream(
    s3Key: string,
  ): Promise<{ stream: NodeJS.ReadableStream; contentLength: number }> {
    const { S3Client, GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    const bucket = this.configService.get('AWS_S3_BUCKET')!;
    const headRes = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key }));
    const contentLength = headRes.ContentLength ?? 0;
    const getRes = await client.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    return { stream: getRes.Body as NodeJS.ReadableStream, contentLength };
  }

  private async downloadS3ToFile(s3Key: string, destPath: string): Promise<void> {
    const { stream } = await this.getS3Stream(s3Key);
    const writeStream = fs.createWriteStream(destPath);
    await new Promise<void>((resolve, reject) => {
      (stream as NodeJS.ReadableStream).pipe(writeStream as any);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private async getPresignedUrl(s3Key: string): Promise<string> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    const bucket = this.configService.get('AWS_S3_BUCKET')!;
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      { expiresIn: 3600 }, // 1 hour — covers Instagram container processing
    );
  }

  private async log(
    scheduledPostId: string,
    event: LogEvent,
    metadata?: Record<string, any>,
    attemptNumber = 1,
  ): Promise<void> {
    await this.uploadLogRepo
      .save(
        this.uploadLogRepo.create({
          scheduled_post_id: scheduledPostId,
          event,
          metadata: metadata ?? null,
          attempt_number: attemptNumber,
        }),
      )
      .catch((err) => this.logger.error(`Failed to write upload log: ${err.message}`));
  }
}
