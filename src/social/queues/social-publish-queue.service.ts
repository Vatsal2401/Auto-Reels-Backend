import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  SOCIAL_PUBLISH_QUEUE_YOUTUBE,
  SOCIAL_PUBLISH_QUEUE_TIKTOK,
  SOCIAL_PUBLISH_QUEUE_INSTAGRAM,
  JOB_PUBLISH_POST,
} from './social-publish-queue.constants';
import { SocialPlatform } from '../entities/connected-account.entity';

function buildRedisConnection(configService: ConfigService) {
  const url = configService.get<string>('REDIS_URL');
  if (url) return { url };
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
  };
}


@Injectable()
export class SocialPublishQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocialPublishQueueService.name);
  private queues = new Map<SocialPlatform, Queue>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connection = buildRedisConnection(this.configService);
    const platformConfigs: Array<{ platform: SocialPlatform; name: string }> = [
      { platform: SocialPlatform.YOUTUBE,   name: SOCIAL_PUBLISH_QUEUE_YOUTUBE },
      { platform: SocialPlatform.TIKTOK,    name: SOCIAL_PUBLISH_QUEUE_TIKTOK },
      { platform: SocialPlatform.INSTAGRAM, name: SOCIAL_PUBLISH_QUEUE_INSTAGRAM },
    ];

    for (const { platform, name } of platformConfigs) {
      const q = new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      });
      this.queues.set(platform, q);
      this.logger.log(`Queue initialized: ${name}`);
    }
  }

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  async schedulePost(
    scheduledPostId: string,
    platform: SocialPlatform,
    scheduledAt: Date,
  ): Promise<void> {
    const queue = this.queues.get(platform);
    if (!queue) throw new Error(`No queue configured for platform: ${platform}`);

    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await queue.add(
      JOB_PUBLISH_POST,
      { scheduledPostId },
      {
        delay,
        jobId: `post-${scheduledPostId}`, // prevents duplicate scheduling
        // Stall protection via Worker stalledInterval + lockDuration (C6)
      },
    );
    this.logger.log(
      `Scheduled post ${scheduledPostId} on ${platform} in ${Math.round(delay / 1000)}s`,
    );
  }

  async cancelPost(scheduledPostId: string, platform: SocialPlatform): Promise<void> {
    const queue = this.queues.get(platform);
    if (!queue) return;
    const job = await queue.getJob(`post-${scheduledPostId}`);
    if (job) await job.remove();
  }

  async reschedulePost(
    scheduledPostId: string,
    platform: SocialPlatform,
    newTime: Date,
  ): Promise<void> {
    await this.cancelPost(scheduledPostId, platform);
    await this.schedulePost(scheduledPostId, platform, newTime);
  }
}
