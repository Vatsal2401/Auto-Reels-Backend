import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Campaign } from '../entities/campaign.entity';
import { CampaignAnalyticsDaily } from '../entities/campaign-analytics-daily.entity';
import { CampaignPost } from '../entities/campaign-post.entity';
import { CampaignPostMetrics } from '../entities/campaign-post-metrics.entity';

@Injectable()
export class CampaignAnalyticsService {
  private readonly logger = new Logger(CampaignAnalyticsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignAnalyticsDaily)
    private readonly dailyRepo: Repository<CampaignAnalyticsDaily>,
    @InjectRepository(CampaignPost)
    private readonly postRepo: Repository<CampaignPost>,
    @InjectRepository(CampaignPostMetrics)
    private readonly metricsRepo: Repository<CampaignPostMetrics>,
    private readonly dataSource: DataSource,
  ) {}

  private async assertOwner(userId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException('Access denied');
    return campaign;
  }

  /** Summary stats card data — top four metrics on analytics tab */
  async getCampaignStats(
    userId: string,
    campaignId: string,
  ): Promise<{
    totalPosts: number;
    publishedPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    avgEngagementRate: number | null;
    followersGained: number;
  }> {
    const campaign = await this.assertOwner(userId, campaignId);

    const rows = await this.dailyRepo
      .createQueryBuilder('d')
      .select([
        'SUM(d.posts_published)::int          AS "totalPosts"',
        'SUM(d.total_views)::bigint           AS "totalViews"',
        'SUM(d.total_likes)::bigint           AS "totalLikes"',
        'SUM(d.total_comments)::bigint        AS "totalComments"',
        'AVG(d.avg_engagement_rate)::numeric  AS "avgEngagementRate"',
        'SUM(d.followers_gained)::int         AS "followersGained"',
      ])
      .where('d.campaign_id = :id', { id: campaignId })
      .getRawOne();

    return {
      totalPosts: campaign.cached_total_posts,
      publishedPosts: campaign.cached_published_posts,
      totalViews: parseInt(rows?.totalViews ?? '0', 10),
      totalLikes: parseInt(rows?.totalLikes ?? '0', 10),
      totalComments: parseInt(rows?.totalComments ?? '0', 10),
      avgEngagementRate: rows?.avgEngagementRate ? parseFloat(rows.avgEngagementRate) : null,
      followersGained: parseInt(rows?.followersGained ?? '0', 10),
    };
  }

  /** Daily time-series data for views-over-time chart */
  async getDailyBreakdown(
    userId: string,
    campaignId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CampaignAnalyticsDaily[]> {
    await this.assertOwner(userId, campaignId);

    const qb = this.dailyRepo
      .createQueryBuilder('d')
      .where('d.campaign_id = :id', { id: campaignId })
      .orderBy('d.date', 'ASC');

    if (startDate) qb.andWhere('d.date >= :startDate', { startDate });
    if (endDate) qb.andWhere('d.date <= :endDate', { endDate });

    return qb.getMany();
  }

  /** Per-post pipeline table in the analytics tab — includes scheduled_post child rows */
  async getPostPipelineTable(
    userId: string,
    campaignId: string,
    pipelineStatus?: string,
  ): Promise<Array<CampaignPost & { scheduled_posts: Array<{
    id: string;
    platform: string;
    status: string;
    account_name: string | null;
    platform_account_id: string | null;
    platform_post_id: string | null;
    scheduled_at: Date;
  }> }>> {
    await this.assertOwner(userId, campaignId);

    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.campaign_id = :id', { id: campaignId })
      .orderBy('p.day_number', 'ASC')
      .addOrderBy('p.sort_order', 'ASC');

    if (pipelineStatus) qb.andWhere('p.pipeline_status = :status', { status: pipelineStatus });

    const posts = await qb.getMany();
    if (!posts.length) return [];

    const postIds = posts.map((p) => p.id);

    // Fetch all scheduled_posts + connected_account name in one query
    const scheduledRows: Array<{
      campaign_post_id: string;
      id: string;
      platform: string;
      status: string;
      platform_post_id: string | null;
      scheduled_at: Date;
      account_name: string | null;
      platform_account_id: string | null;
    }> = await this.dataSource.query(
      `SELECT sp.campaign_post_id, sp.id, sp.platform, sp.status,
              sp.platform_post_id, sp.scheduled_at,
              ca.account_name, ca.platform_account_id
       FROM scheduled_posts sp
       LEFT JOIN connected_accounts ca ON ca.id = sp.connected_account_id
       WHERE sp.campaign_post_id = ANY($1)
       ORDER BY sp.scheduled_at ASC`,
      [postIds],
    );

    // Group by campaign_post_id
    const grouped = new Map<string, typeof scheduledRows>();
    for (const row of scheduledRows) {
      if (!grouped.has(row.campaign_post_id)) grouped.set(row.campaign_post_id, []);
      grouped.get(row.campaign_post_id)!.push(row);
    }

    return posts.map((p) => ({
      ...p,
      scheduled_posts: (grouped.get(p.id) ?? []).map((sp) => ({
        id: sp.id,
        platform: sp.platform,
        status: sp.status,
        account_name: sp.account_name,
        platform_account_id: sp.platform_account_id,
        platform_post_id: sp.platform_post_id,
        scheduled_at: sp.scheduled_at,
      })),
    }));
  }

  /** Platform breakdown for the pie/bar chart */
  async getPlatformBreakdown(userId: string, campaignId: string): Promise<Record<string, any>> {
    await this.assertOwner(userId, campaignId);

    const rows = await this.dailyRepo
      .createQueryBuilder('d')
      .select('d.platform_breakdown')
      .where('d.campaign_id = :id', { id: campaignId })
      .getMany();

    // Merge all daily platform_breakdown objects
    const merged: Record<string, { views: number; likes: number; posts: number }> = {};
    for (const row of rows) {
      for (const [platform, data] of Object.entries(
        row.platform_breakdown as Record<string, any>,
      )) {
        if (!merged[platform]) merged[platform] = { views: 0, likes: 0, posts: 0 };
        merged[platform].views += data.views ?? 0;
        merged[platform].likes += data.likes ?? 0;
        merged[platform].posts += data.posts ?? 0;
      }
    }

    return merged;
  }
}
