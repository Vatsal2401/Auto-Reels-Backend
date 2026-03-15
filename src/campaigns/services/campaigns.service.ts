import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignStatus } from '../entities/campaign.entity';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';

// Valid status transitions — archived is terminal
const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  [CampaignStatus.ACTIVE]: [CampaignStatus.PAUSED, CampaignStatus.ARCHIVED],
  [CampaignStatus.PAUSED]: [CampaignStatus.ACTIVE, CampaignStatus.ARCHIVED],
  [CampaignStatus.ARCHIVED]: [],
};

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
  ) {}

  async create(userId: string, dto: CreateCampaignDto): Promise<Campaign> {
    if (dto.start_date && dto.end_date && dto.end_date <= dto.start_date) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const campaign = this.campaignRepo.create({
      user_id: userId,
      name: dto.name,
      goal_type: dto.goal_type,
      goal_description: dto.goal_description ?? null,
      visual_style: dto.visual_style ?? null,
      icp_criteria: dto.icp_criteria ?? null,
      start_date: dto.start_date ?? null,
      end_date: dto.end_date ?? null,
      posting_cadence_days: dto.posting_cadence_days ?? 1,
      target_platforms: dto.target_platforms ?? [],
    });

    return this.campaignRepo.save(campaign);
  }

  async findAll(userId: string, status?: CampaignStatus): Promise<Campaign[]> {
    const where: Record<string, any> = { user_id: userId };
    if (status) where.status = status;

    return this.campaignRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException('Access denied');
    return campaign;
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(userId, id);

    if (dto.status && dto.status !== campaign.status) {
      const allowed = VALID_TRANSITIONS[campaign.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from '${campaign.status}' to '${dto.status}'`,
        );
      }
    }

    if (dto.start_date && dto.end_date && dto.end_date <= dto.start_date) {
      throw new BadRequestException('end_date must be after start_date');
    }

    Object.assign(campaign, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.goal_type !== undefined && { goal_type: dto.goal_type }),
      ...(dto.goal_description !== undefined && { goal_description: dto.goal_description }),
      ...(dto.visual_style !== undefined && { visual_style: dto.visual_style }),
      ...(dto.icp_criteria !== undefined && { icp_criteria: dto.icp_criteria }),
      ...(dto.start_date !== undefined && { start_date: dto.start_date }),
      ...(dto.end_date !== undefined && { end_date: dto.end_date }),
      ...(dto.posting_cadence_days !== undefined && {
        posting_cadence_days: dto.posting_cadence_days,
      }),
      ...(dto.target_platforms !== undefined && { target_platforms: dto.target_platforms }),
    });

    return this.campaignRepo.save(campaign);
  }

  async archive(userId: string, id: string): Promise<void> {
    const campaign = await this.findOne(userId, id);
    if (campaign.status === CampaignStatus.ARCHIVED) return;
    await this.campaignRepo.update(id, { status: CampaignStatus.ARCHIVED });
  }

  async updateCachedCounts(
    campaignId: string,
    totalPosts: number,
    publishedPosts: number,
  ): Promise<void> {
    await this.campaignRepo.update(campaignId, {
      cached_total_posts: totalPosts,
      cached_published_posts: publishedPosts,
    });
  }
}
