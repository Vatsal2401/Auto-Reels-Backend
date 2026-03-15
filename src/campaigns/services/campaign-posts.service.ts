import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Campaign } from '../entities/campaign.entity';
import {
  CampaignPost,
  CampaignPostPipelineStatus,
  ContentSource,
} from '../entities/campaign-post.entity';
import { CreateCampaignPostDto } from '../dto/create-campaign-post.dto';
import { UpdateCampaignPostDto } from '../dto/update-campaign-post.dto';

@Injectable()
export class CampaignPostsService {
  private readonly logger = new Logger(CampaignPostsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignPost)
    private readonly postRepo: Repository<CampaignPost>,
    private readonly dataSource: DataSource,
  ) {}

  private async assertCampaignOwner(userId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException('Access denied');
    return campaign;
  }

  async create(
    userId: string,
    campaignId: string,
    dto: CreateCampaignPostDto,
  ): Promise<CampaignPost> {
    await this.assertCampaignOwner(userId, campaignId);

    const contentSource = dto.content_source ?? ContentSource.NEW;

    // Existing content is already ready — skip draft/generating and go straight to ready
    const initialStatus =
      contentSource === ContentSource.EXISTING && dto.source_entity_id
        ? CampaignPostPipelineStatus.READY
        : CampaignPostPipelineStatus.DRAFT;

    const post = this.postRepo.create({
      campaign_id: campaignId,
      day_number: dto.day_number,
      sort_order: dto.sort_order ?? 0,
      post_type: dto.post_type,
      content_source: contentSource,
      source_entity_type: dto.source_entity_type ?? null,
      source_entity_id: dto.source_entity_id ?? null,
      title: dto.title ?? null,
      hook: dto.hook ?? null,
      caption: dto.caption ?? null,
      script: dto.script ?? null,
      hashtags: dto.hashtags ?? null,
      target_platforms: dto.target_platforms ?? [],
      pipeline_status: initialStatus,
    });

    const saved = await this.postRepo.save(post);
    await this.refreshCampaignCounts(campaignId);
    return saved;
  }

  async findAll(userId: string, campaignId: string): Promise<CampaignPost[]> {
    await this.assertCampaignOwner(userId, campaignId);
    return this.postRepo.find({
      where: { campaign_id: campaignId },
      order: { day_number: 'ASC', sort_order: 'ASC' },
    });
  }

  async findOne(userId: string, campaignId: string, postId: string): Promise<CampaignPost> {
    await this.assertCampaignOwner(userId, campaignId);
    const post = await this.postRepo.findOne({ where: { id: postId, campaign_id: campaignId } });
    if (!post) throw new NotFoundException('Campaign post not found');
    return post;
  }

  async update(
    userId: string,
    campaignId: string,
    postId: string,
    dto: UpdateCampaignPostDto,
  ): Promise<CampaignPost> {
    const post = await this.findOne(userId, campaignId, postId);

    Object.assign(post, {
      ...(dto.day_number !== undefined && { day_number: dto.day_number }),
      ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
      ...(dto.post_type !== undefined && { post_type: dto.post_type }),
      ...(dto.content_source !== undefined && { content_source: dto.content_source }),
      ...(dto.source_entity_type !== undefined && { source_entity_type: dto.source_entity_type }),
      ...(dto.source_entity_id !== undefined && { source_entity_id: dto.source_entity_id }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.hook !== undefined && { hook: dto.hook }),
      ...(dto.caption !== undefined && { caption: dto.caption }),
      ...(dto.script !== undefined && { script: dto.script }),
      ...(dto.hashtags !== undefined && { hashtags: dto.hashtags }),
      ...(dto.target_platforms !== undefined && { target_platforms: dto.target_platforms }),
      ...(dto.scheduled_at !== undefined && { scheduled_at: new Date(dto.scheduled_at) }),
    });

    return this.postRepo.save(post);
  }

  async remove(userId: string, campaignId: string, postId: string): Promise<void> {
    const post = await this.findOne(userId, campaignId, postId);

    // Cancel any linked scheduled_posts before deleting — prevents orphaned publish jobs
    await this.dataSource.query(
      `UPDATE scheduled_posts
          SET status = 'cancelled', updated_at = now()
        WHERE campaign_post_id = $1
          AND status IN ('pending', 'uploading')`,
      [postId],
    );

    await this.postRepo.remove(post);
    await this.refreshCampaignCounts(campaignId);
  }

  /**
   * Called by social-publish.worker after each scheduled_post status change.
   * Derives campaign_post pipeline_status from all its linked scheduled_posts.
   * Uses raw SQL so the social module has zero dependency on this service.
   */
  async syncPipelineStatus(campaignPostId: string): Promise<void> {
    try {
      const rows: Array<{ status: string }> = await this.dataSource.query(
        `SELECT status FROM scheduled_posts WHERE campaign_post_id = $1`,
        [campaignPostId],
      );

      if (!rows.length) return;

      const statuses = rows.map((r) => r.status);
      const allSuccess = statuses.every((s) => s === 'success');
      const anyFailed = statuses.some((s) => s === 'failed');

      let newStatus: CampaignPostPipelineStatus;
      if (allSuccess) newStatus = CampaignPostPipelineStatus.PUBLISHED;
      else if (anyFailed) newStatus = CampaignPostPipelineStatus.FAILED;
      else newStatus = CampaignPostPipelineStatus.PUBLISHING;

      if (newStatus === CampaignPostPipelineStatus.PUBLISHED) {
        await this.dataSource.query(
          `UPDATE campaign_posts
              SET pipeline_status = $1, published_at = now(), updated_at = now()
            WHERE id = $2`,
          [newStatus, campaignPostId],
        );

        // Increment cached_published_posts on the parent campaign
        await this.dataSource.query(
          `UPDATE campaigns
              SET cached_published_posts = cached_published_posts + 1, updated_at = now()
            WHERE id = (SELECT campaign_id FROM campaign_posts WHERE id = $1)`,
          [campaignPostId],
        );
      } else {
        await this.dataSource.query(
          `UPDATE campaign_posts
              SET pipeline_status = $1, updated_at = now()
            WHERE id = $2`,
          [newStatus, campaignPostId],
        );
      }
    } catch (err: any) {
      this.logger.error(
        `syncPipelineStatus.error campaignPostId=${campaignPostId}: ${err.message}`,
      );
    }
  }

  private async refreshCampaignCounts(campaignId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE campaigns
          SET cached_total_posts     = (SELECT COUNT(*) FROM campaign_posts WHERE campaign_id = $1),
              cached_published_posts = (SELECT COUNT(*) FROM campaign_posts WHERE campaign_id = $1 AND pipeline_status = 'published'),
              updated_at             = now()
        WHERE id = $1`,
      [campaignId],
    );
  }
}
