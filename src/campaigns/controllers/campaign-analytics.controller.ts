import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CampaignAnalyticsService } from '../services/campaign-analytics.service';

@ApiTags('campaign-analytics')
@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/analytics')
export class CampaignAnalyticsController {
  constructor(private readonly campaignAnalyticsService: CampaignAnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregate stats for a campaign' })
  getSummary(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.campaignAnalyticsService.getCampaignStats(user.userId, campaignId);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily analytics breakdown for chart rendering' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date (YYYY-MM-DD)' })
  getDailyBreakdown(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.campaignAnalyticsService.getDailyBreakdown(user.userId, campaignId, from, to);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get per-post performance table with metrics' })
  getPostsTable(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.campaignAnalyticsService.getPostPipelineTable(user.userId, campaignId);
  }

  @Get('platforms')
  @ApiOperation({ summary: 'Get platform-level engagement breakdown' })
  getPlatformBreakdown(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.campaignAnalyticsService.getPlatformBreakdown(user.userId, campaignId);
  }
}
