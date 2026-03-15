import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Campaign } from '../entities/campaign.entity';
import { CampaignPost, CampaignPostPipelineStatus } from '../entities/campaign-post.entity';
import { CampaignAccount } from '../entities/campaign-account.entity';
import { AccountPublishingSettings } from '../entities/account-publishing-settings.entity';
import { CampaignAccountsService } from './campaign-accounts.service';
import {
  SOCIAL_PUBLISH_QUEUE_INSTAGRAM,
  SOCIAL_PUBLISH_QUEUE_TIKTOK,
  SOCIAL_PUBLISH_QUEUE_YOUTUBE,
  JOB_PUBLISH_POST,
} from '../../social/queues/social-publish-queue.constants';

const SCHEDULABLE_STATUSES = [
  CampaignPostPipelineStatus.READY,
  CampaignPostPipelineStatus.AWAITING_SCHEDULE,
];

const PLATFORM_QUEUE: Record<string, string> = {
  instagram: SOCIAL_PUBLISH_QUEUE_INSTAGRAM,
  tiktok: SOCIAL_PUBLISH_QUEUE_TIKTOK,
  youtube: SOCIAL_PUBLISH_QUEUE_YOUTUBE,
};

export interface ScheduleResult {
  scheduledCount: number;
  blockedAccounts: Array<{ accountId: string; accountName: string | null; reason: string }>;
  softLimitWarnings: Array<{
    accountId: string;
    accountName: string | null;
    dailyCount: number;
    weeklyCount: number;
  }>;
}

@Injectable()
export class CampaignPublishService implements OnModuleDestroy {
  private readonly logger = new Logger(CampaignPublishService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignPost)
    private readonly postRepo: Repository<CampaignPost>,
    @InjectRepository(CampaignAccount)
    private readonly campaignAccountRepo: Repository<CampaignAccount>,
    @InjectRepository(AccountPublishingSettings)
    private readonly settingsRepo: Repository<AccountPublishingSettings>,
    private readonly campaignAccountsService: CampaignAccountsService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    const connection = this.buildRedisConnection();
    for (const [platform, queueName] of Object.entries(PLATFORM_QUEUE)) {
      this.queues.set(platform, new Queue(queueName, { connection }));
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  async schedulePost(
    userId: string,
    campaignId: string,
    postId: string,
    scheduledAt: Date,
  ): Promise<ScheduleResult> {
    // Validate campaign ownership
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException('Access denied');

    // Validate post
    const post = await this.postRepo.findOne({ where: { id: postId, campaign_id: campaignId } });
    if (!post) throw new NotFoundException('Campaign post not found');

    if (!SCHEDULABLE_STATUSES.includes(post.pipeline_status)) {
      throw new BadRequestException(
        `Post cannot be scheduled from status '${post.pipeline_status}'. Must be 'ready' or 'awaiting_schedule'.`,
      );
    }

    // For existing-source posts, resolve the S3 key — try media table first, then projects.output_url
    if (!post.rendered_s3_key && post.source_entity_id) {
      // 1) Video/reel projects: media.blob_storage_id
      const mediaRows: Array<{ blob_storage_id: string }> = await this.dataSource.query(
        `SELECT blob_storage_id FROM media WHERE project_id = $1 AND blob_storage_id IS NOT NULL LIMIT 1`,
        [post.source_entity_id],
      );
      if (mediaRows.length && mediaRows[0].blob_storage_id) {
        post.rendered_s3_key = mediaRows[0].blob_storage_id;
      }

      // 2) Image/graphic projects: projects.output_url stores the S3 key directly
      if (!post.rendered_s3_key) {
        const projectRows: Array<{ output_url: string }> = await this.dataSource.query(
          `SELECT output_url FROM projects WHERE id = $1 AND output_url IS NOT NULL LIMIT 1`,
          [post.source_entity_id],
        );
        if (projectRows.length && projectRows[0].output_url) {
          post.rendered_s3_key = projectRows[0].output_url;
        }
      }

      if (post.rendered_s3_key) {
        await this.postRepo.update(post.id, { rendered_s3_key: post.rendered_s3_key });
      }
    }

    if (!post.rendered_s3_key) {
      throw new BadRequestException('Content not yet rendered — rendered_s3_key is missing');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduled_at must be in the future');
    }

    // Get active campaign accounts that match this post's target platforms
    const postPlatforms = post.target_platforms.length
      ? post.target_platforms
      : campaign.target_platforms;

    const campaignAccounts = await this.campaignAccountRepo.find({
      where: { campaign_id: campaignId, is_active: true },
      relations: ['connected_account'],
      order: { priority: 'ASC' },
    });

    if (!campaignAccounts.length) {
      throw new BadRequestException('No active accounts connected to this campaign');
    }

    const result: ScheduleResult = {
      scheduledCount: 0,
      blockedAccounts: [],
      softLimitWarnings: [],
    };

    for (const ca of campaignAccounts) {
      const connectedAccount = ca.connected_account;
      const accountPlatform = connectedAccount.platform; // 'instagram' | 'tiktok' | 'youtube'

      // Only schedule to accounts whose platform is in the post's target list
      if (!postPlatforms.includes(accountPlatform)) continue;
      if (!connectedAccount.is_active) continue;
      if (connectedAccount.needs_reauth) {
        result.blockedAccounts.push({
          accountId: ca.connected_account_id,
          accountName: connectedAccount.account_name,
          reason: 'Account needs re-authentication',
        });
        continue;
      }

      // Get publishing settings (lazy-create if missing)
      let settings = await this.settingsRepo.findOne({
        where: { connected_account_id: ca.connected_account_id },
      });
      if (!settings) {
        settings = this.settingsRepo.create({ connected_account_id: ca.connected_account_id });
        settings = await this.settingsRepo.save(settings);
      }

      // Check limits
      const limitCheck = await this.campaignAccountsService.checkLimits(
        ca.connected_account_id,
        ca,
        settings,
        scheduledAt,
      );

      if (limitCheck.blocked) {
        result.blockedAccounts.push({
          accountId: ca.connected_account_id,
          accountName: connectedAccount.account_name,
          reason: `Hard limit reached — daily: ${limitCheck.dailyCount}, weekly: ${limitCheck.weeklyCount}, monthly: ${limitCheck.monthlyCount}`,
        });
        continue;
      }

      if (limitCheck.warned) {
        result.softLimitWarnings.push({
          accountId: ca.connected_account_id,
          accountName: connectedAccount.account_name,
          dailyCount: limitCheck.dailyCount,
          weeklyCount: limitCheck.weeklyCount,
        });
      }

      // Create scheduled_post row (with campaign_post_id FK)
      const scheduledPostId = await this.createScheduledPost(
        userId,
        ca,
        post,
        campaign,
        accountPlatform,
        scheduledAt,
      );

      // Enqueue BullMQ job with delay
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      const queue = this.queues.get(accountPlatform);
      if (queue) {
        await queue.add(
          JOB_PUBLISH_POST,
          { scheduledPostId },
          {
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
          },
        );
      }

      result.scheduledCount++;
    }

    if (result.scheduledCount === 0 && !result.blockedAccounts.length) {
      throw new BadRequestException(
        "No matching active accounts found for this post's target platforms",
      );
    }

    // Update post status
    await this.postRepo.update(postId, {
      pipeline_status: CampaignPostPipelineStatus.SCHEDULED,
      scheduled_at: scheduledAt,
    });

    return result;
  }

  private async createScheduledPost(
    userId: string,
    ca: CampaignAccount,
    post: CampaignPost,
    campaign: Campaign,
    platform: string,
    scheduledAt: Date,
  ): Promise<string> {
    // Prefer explicit post title, fall back to campaign name — never use raw script/prompt
    const displayTitle = post.title?.trim() || campaign.name;

    const publishOptions: Record<string, any> = {
      caption: post.caption,
      hashtags: post.hashtags,
      title: displayTitle,
    };

    const result: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO scheduled_posts
         (user_id, connected_account_id, platform, video_s3_key,
          video_topic, scheduled_at, status, publish_options, campaign_post_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
       RETURNING id`,
      [
        userId,
        ca.connected_account_id,
        platform,
        post.rendered_s3_key,
        displayTitle,
        scheduledAt,
        JSON.stringify(publishOptions),
        post.id,
      ],
    );

    return result[0].id;
  }

  private buildRedisConnection(): { url: string } | { host: string; port: number } {
    const url = this.configService.get<string>('REDIS_URL');
    if (url) return { url };
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };
  }
}
