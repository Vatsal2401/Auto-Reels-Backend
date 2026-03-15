import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Campaign } from './entities/campaign.entity';
import { CampaignPost } from './entities/campaign-post.entity';
import { CampaignAccount } from './entities/campaign-account.entity';
import { AccountPublishingSettings } from './entities/account-publishing-settings.entity';
import { CampaignPostMetrics } from './entities/campaign-post-metrics.entity';
import { CampaignAnalyticsDaily } from './entities/campaign-analytics-daily.entity';
import { ConnectedAccount } from '../social/entities/connected-account.entity';

import { CampaignsService } from './services/campaigns.service';
import { CampaignPostsService } from './services/campaign-posts.service';
import { CampaignAccountsService } from './services/campaign-accounts.service';
import { CampaignPublishService } from './services/campaign-publish.service';
import { CampaignAnalyticsService } from './services/campaign-analytics.service';

import { CampaignsController } from './campaigns.controller';
import { CampaignPostsController } from './controllers/campaign-posts.controller';
import {
  CampaignAccountsController,
  PublishingSettingsController,
} from './controllers/campaign-accounts.controller';
import { CampaignAnalyticsController } from './controllers/campaign-analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignPost,
      CampaignAccount,
      AccountPublishingSettings,
      CampaignPostMetrics,
      CampaignAnalyticsDaily,
      ConnectedAccount,
    ]),
  ],
  controllers: [
    CampaignsController,
    CampaignPostsController,
    CampaignAccountsController,
    PublishingSettingsController,
    CampaignAnalyticsController,
  ],
  providers: [
    CampaignsService,
    CampaignPostsService,
    CampaignAccountsService,
    CampaignPublishService,
    CampaignAnalyticsService,
  ],
  exports: [CampaignsService, CampaignPostsService],
})
export class CampaignsModule {}
