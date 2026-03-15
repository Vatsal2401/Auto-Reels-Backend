import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Campaign } from '../entities/campaign.entity';
import { CampaignAccount } from '../entities/campaign-account.entity';
import { AccountPublishingSettings } from '../entities/account-publishing-settings.entity';
import { ConnectedAccount } from '../../social/entities/connected-account.entity';
import { AddCampaignAccountDto } from '../dto/add-campaign-account.dto';
import { UpdateCampaignAccountDto } from '../dto/update-campaign-account.dto';
import { UpdatePublishingSettingsDto } from '../dto/update-publishing-settings.dto';

export interface EffectiveLimits {
  soft_daily: number;
  hard_daily: number;
  soft_weekly: number;
  hard_weekly: number;
  soft_monthly: number;
  hard_monthly: number;
  timezone: string;
  min_hours_between_posts: number;
}

export interface LimitCheckResult {
  blocked: boolean; // hard limit hit
  warned: boolean; // soft limit hit
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}

@Injectable()
export class CampaignAccountsService {
  private readonly logger = new Logger(CampaignAccountsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignAccount)
    private readonly campaignAccountRepo: Repository<CampaignAccount>,
    @InjectRepository(AccountPublishingSettings)
    private readonly settingsRepo: Repository<AccountPublishingSettings>,
    @InjectRepository(ConnectedAccount)
    private readonly connectedAccountRepo: Repository<ConnectedAccount>,
    private readonly dataSource: DataSource,
  ) {}

  private async assertCampaignOwner(userId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException('Access denied');
    return campaign;
  }

  async addAccount(
    userId: string,
    campaignId: string,
    dto: AddCampaignAccountDto,
  ): Promise<CampaignAccount> {
    await this.assertCampaignOwner(userId, campaignId);

    // Verify the connected_account belongs to this user
    const account = await this.connectedAccountRepo.findOne({
      where: { id: dto.connected_account_id, user_id: userId },
    });
    if (!account) throw new NotFoundException('Connected account not found');

    // Validate overrides: soft must be < hard when both provided
    this.validateOverrides(dto);

    // Prevent duplicate
    const existing = await this.campaignAccountRepo.findOne({
      where: { campaign_id: campaignId, connected_account_id: dto.connected_account_id },
    });
    if (existing) throw new ConflictException('Account already added to this campaign');

    // Ensure account_publishing_settings exists (lazy-create with defaults)
    await this.getOrCreateSettings(dto.connected_account_id);

    const ca = this.campaignAccountRepo.create({
      campaign_id: campaignId,
      connected_account_id: dto.connected_account_id,
      priority: dto.priority ?? 5,
      override_soft_daily_posts: dto.override_soft_daily_posts ?? null,
      override_hard_daily_posts: dto.override_hard_daily_posts ?? null,
      override_soft_weekly_posts: dto.override_soft_weekly_posts ?? null,
      override_hard_weekly_posts: dto.override_hard_weekly_posts ?? null,
      notes: dto.notes ?? null,
    });

    return this.campaignAccountRepo.save(ca);
  }

  async listAccounts(userId: string, campaignId: string): Promise<CampaignAccount[]> {
    await this.assertCampaignOwner(userId, campaignId);
    return this.campaignAccountRepo.find({
      where: { campaign_id: campaignId },
      relations: ['connected_account'],
      order: { priority: 'ASC' },
    });
  }

  async updateAccount(
    userId: string,
    campaignId: string,
    accountId: string,
    dto: UpdateCampaignAccountDto,
  ): Promise<CampaignAccount> {
    await this.assertCampaignOwner(userId, campaignId);

    const ca = await this.campaignAccountRepo.findOne({
      where: { id: accountId, campaign_id: campaignId },
    });
    if (!ca) throw new NotFoundException('Campaign account not found');

    this.validateOverrides({
      override_soft_daily_posts:
        dto.override_soft_daily_posts ?? ca.override_soft_daily_posts ?? undefined,
      override_hard_daily_posts:
        dto.override_hard_daily_posts ?? ca.override_hard_daily_posts ?? undefined,
      override_soft_weekly_posts:
        dto.override_soft_weekly_posts ?? ca.override_soft_weekly_posts ?? undefined,
      override_hard_weekly_posts:
        dto.override_hard_weekly_posts ?? ca.override_hard_weekly_posts ?? undefined,
    });

    Object.assign(ca, {
      ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.override_soft_daily_posts !== undefined && {
        override_soft_daily_posts: dto.override_soft_daily_posts,
      }),
      ...(dto.override_hard_daily_posts !== undefined && {
        override_hard_daily_posts: dto.override_hard_daily_posts,
      }),
      ...(dto.override_soft_weekly_posts !== undefined && {
        override_soft_weekly_posts: dto.override_soft_weekly_posts,
      }),
      ...(dto.override_hard_weekly_posts !== undefined && {
        override_hard_weekly_posts: dto.override_hard_weekly_posts,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updated_at: new Date(),
    });

    return this.campaignAccountRepo.save(ca);
  }

  async removeAccount(userId: string, campaignId: string, accountId: string): Promise<void> {
    await this.assertCampaignOwner(userId, campaignId);
    const ca = await this.campaignAccountRepo.findOne({
      where: { id: accountId, campaign_id: campaignId },
    });
    if (!ca) throw new NotFoundException('Campaign account not found');
    await this.campaignAccountRepo.remove(ca);
  }

  async getPublishingSettings(
    userId: string,
    accountId: string,
  ): Promise<AccountPublishingSettings> {
    const account = await this.connectedAccountRepo.findOne({
      where: { id: accountId, user_id: userId },
    });
    if (!account) throw new NotFoundException('Connected account not found');
    return this.getOrCreateSettings(accountId);
  }

  async updatePublishingSettings(
    userId: string,
    accountId: string,
    dto: UpdatePublishingSettingsDto,
  ): Promise<AccountPublishingSettings> {
    const account = await this.connectedAccountRepo.findOne({
      where: { id: accountId, user_id: userId },
    });
    if (!account) throw new NotFoundException('Connected account not found');

    const settings = await this.getOrCreateSettings(accountId);

    // Merge new values with existing to validate soft < hard
    const merged = {
      soft_daily: dto.soft_daily_posts ?? settings.soft_daily_posts,
      hard_daily: dto.hard_daily_posts ?? settings.hard_daily_posts,
      soft_weekly: dto.soft_weekly_posts ?? settings.soft_weekly_posts,
      hard_weekly: dto.hard_weekly_posts ?? settings.hard_weekly_posts,
      soft_monthly: dto.soft_monthly_posts ?? settings.soft_monthly_posts,
      hard_monthly: dto.hard_monthly_posts ?? settings.hard_monthly_posts,
    };

    if (merged.soft_daily >= merged.hard_daily)
      throw new BadRequestException('soft_daily_posts must be less than hard_daily_posts');
    if (merged.soft_weekly >= merged.hard_weekly)
      throw new BadRequestException('soft_weekly_posts must be less than hard_weekly_posts');
    if (merged.soft_monthly >= merged.hard_monthly)
      throw new BadRequestException('soft_monthly_posts must be less than hard_monthly_posts');

    Object.assign(settings, {
      ...(dto.soft_daily_posts !== undefined && { soft_daily_posts: dto.soft_daily_posts }),
      ...(dto.soft_weekly_posts !== undefined && { soft_weekly_posts: dto.soft_weekly_posts }),
      ...(dto.soft_monthly_posts !== undefined && { soft_monthly_posts: dto.soft_monthly_posts }),
      ...(dto.hard_daily_posts !== undefined && { hard_daily_posts: dto.hard_daily_posts }),
      ...(dto.hard_weekly_posts !== undefined && { hard_weekly_posts: dto.hard_weekly_posts }),
      ...(dto.hard_monthly_posts !== undefined && { hard_monthly_posts: dto.hard_monthly_posts }),
      ...(dto.preferred_posting_times !== undefined && {
        preferred_posting_times: dto.preferred_posting_times,
      }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.min_hours_between_posts !== undefined && {
        min_hours_between_posts: dto.min_hours_between_posts,
      }),
    });

    return this.settingsRepo.save(settings);
  }

  /**
   * Checks both hard and soft limits for a connected account.
   * Counts ALL scheduled_posts for this account (campaign + standalone) within window.
   */
  async checkLimits(
    connectedAccountId: string,
    campaignAccount: CampaignAccount,
    settings: AccountPublishingSettings,
    scheduledAt: Date,
  ): Promise<LimitCheckResult> {
    const limits = this.getEffectiveLimits(campaignAccount, settings);
    const tz = limits.timezone;

    const [dailyRow, weeklyRow, monthlyRow]: Array<[{ count: string }]> = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::text AS count
           FROM scheduled_posts
          WHERE connected_account_id = $1
            AND status NOT IN ('failed', 'cancelled')
            AND DATE(scheduled_at AT TIME ZONE $2) = DATE($3::timestamptz AT TIME ZONE $2)`,
        [connectedAccountId, tz, scheduledAt.toISOString()],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::text AS count
           FROM scheduled_posts
          WHERE connected_account_id = $1
            AND status NOT IN ('failed', 'cancelled')
            AND DATE_TRUNC('week', scheduled_at AT TIME ZONE $2)
              = DATE_TRUNC('week', $3::timestamptz AT TIME ZONE $2)`,
        [connectedAccountId, tz, scheduledAt.toISOString()],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::text AS count
           FROM scheduled_posts
          WHERE connected_account_id = $1
            AND status NOT IN ('failed', 'cancelled')
            AND DATE_TRUNC('month', scheduled_at AT TIME ZONE $2)
              = DATE_TRUNC('month', $3::timestamptz AT TIME ZONE $2)`,
        [connectedAccountId, tz, scheduledAt.toISOString()],
      ),
    ]);

    const daily = parseInt(dailyRow[0].count, 10);
    const weekly = parseInt(weeklyRow[0].count, 10);
    const monthly = parseInt(monthlyRow[0].count, 10);

    const blocked =
      daily >= limits.hard_daily || weekly >= limits.hard_weekly || monthly >= limits.hard_monthly;

    const warned =
      daily >= limits.soft_daily || weekly >= limits.soft_weekly || monthly >= limits.soft_monthly;

    return { blocked, warned, dailyCount: daily, weeklyCount: weekly, monthlyCount: monthly };
  }

  getEffectiveLimits(ca: CampaignAccount, settings: AccountPublishingSettings): EffectiveLimits {
    return {
      soft_daily: ca.override_soft_daily_posts ?? settings.soft_daily_posts,
      hard_daily: ca.override_hard_daily_posts ?? settings.hard_daily_posts,
      soft_weekly: ca.override_soft_weekly_posts ?? settings.soft_weekly_posts,
      hard_weekly: ca.override_hard_weekly_posts ?? settings.hard_weekly_posts,
      soft_monthly: settings.soft_monthly_posts,
      hard_monthly: settings.hard_monthly_posts,
      timezone: settings.timezone,
      min_hours_between_posts: settings.min_hours_between_posts,
    };
  }

  private async getOrCreateSettings(
    connectedAccountId: string,
  ): Promise<AccountPublishingSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { connected_account_id: connectedAccountId },
    });
    if (!settings) {
      settings = this.settingsRepo.create({ connected_account_id: connectedAccountId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  private validateOverrides(dto: {
    override_soft_daily_posts?: number | null;
    override_hard_daily_posts?: number | null;
    override_soft_weekly_posts?: number | null;
    override_hard_weekly_posts?: number | null;
  }): void {
    const {
      override_soft_daily_posts: sd,
      override_hard_daily_posts: hd,
      override_soft_weekly_posts: sw,
      override_hard_weekly_posts: hw,
    } = dto;

    if (sd != null && hd != null && sd >= hd)
      throw new BadRequestException(
        'override_soft_daily_posts must be less than override_hard_daily_posts',
      );
    if (sw != null && hw != null && sw >= hw)
      throw new BadRequestException(
        'override_soft_weekly_posts must be less than override_hard_weekly_posts',
      );
  }
}
