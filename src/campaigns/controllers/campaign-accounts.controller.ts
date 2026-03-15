import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CampaignAccountsService } from '../services/campaign-accounts.service';
import { AddCampaignAccountDto } from '../dto/add-campaign-account.dto';
import { UpdateCampaignAccountDto } from '../dto/update-campaign-account.dto';
import { UpdatePublishingSettingsDto } from '../dto/update-publishing-settings.dto';

@ApiTags('campaign-accounts')
@UseGuards(JwtAuthGuard)
@Controller('campaigns/:campaignId/accounts')
export class CampaignAccountsController {
  constructor(private readonly campaignAccountsService: CampaignAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a connected account to a campaign' })
  addAccount(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: AddCampaignAccountDto,
  ) {
    return this.campaignAccountsService.addAccount(user.userId, campaignId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List accounts attached to a campaign' })
  listAccounts(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.campaignAccountsService.listAccounts(user.userId, campaignId);
  }

  @Patch(':accountId')
  @ApiOperation({ summary: 'Update per-campaign limit overrides for an account' })
  updateAccount(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateCampaignAccountDto,
  ) {
    return this.campaignAccountsService.updateAccount(user.userId, campaignId, accountId, dto);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an account from a campaign' })
  removeAccount(
    @CurrentUser() user: { userId: string },
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    return this.campaignAccountsService.removeAccount(user.userId, campaignId, accountId);
  }
}

@ApiTags('publishing-settings')
@UseGuards(JwtAuthGuard)
@Controller('publishing-settings')
export class PublishingSettingsController {
  constructor(private readonly campaignAccountsService: CampaignAccountsService) {}

  @Get(':connectedAccountId')
  @ApiOperation({ summary: 'Get global publishing settings for a connected account' })
  getSettings(
    @CurrentUser() user: { userId: string },
    @Param('connectedAccountId', ParseUUIDPipe) connectedAccountId: string,
  ) {
    return this.campaignAccountsService.getPublishingSettings(user.userId, connectedAccountId);
  }

  @Patch(':connectedAccountId')
  @ApiOperation({ summary: 'Update global publishing settings for a connected account' })
  updateSettings(
    @CurrentUser() user: { userId: string },
    @Param('connectedAccountId', ParseUUIDPipe) connectedAccountId: string,
    @Body() dto: UpdatePublishingSettingsDto,
  ) {
    return this.campaignAccountsService.updatePublishingSettings(
      user.userId,
      connectedAccountId,
      dto,
    );
  }
}
