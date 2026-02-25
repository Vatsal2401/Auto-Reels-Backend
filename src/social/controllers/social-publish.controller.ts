import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SocialSchedulerEnabledGuard } from '../../user-settings/guards/social-scheduler-enabled.guard';
import { SocialPublishService } from '../services/social-publish.service';
import { SocialAuthService } from '../services/social-auth.service';
import { SchedulePostDto } from '../dto/schedule-post.dto';
import { PostStatus } from '../entities/scheduled-post.entity';

@ApiTags('social')
@ApiBearerAuth()
@Controller('social')
@UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
export class SocialPublishController {
  constructor(
    private readonly publishService: SocialPublishService,
    private readonly authService: SocialAuthService,
  ) {}

  // ─── Connected Accounts ───────────────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List connected social accounts' })
  async listAccounts(@CurrentUser() user: { userId: string }) {
    const accounts = await this.authService.listAccounts(user.userId);
    return accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      platformAccountId: a.platform_account_id,
      accountName: a.account_name,
      accountAvatarUrl: a.account_avatar_url,
      isActive: a.is_active,
      needsReauth: a.needs_reauth,
      tokenExpiresAt: a.token_expires_at,
      connectedAt: a.created_at,
    }));
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Disconnect a social account' })
  async disconnectAccount(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) accountId: string,
  ) {
    await this.authService.disconnectAccount(user.userId, accountId);
    return { success: true };
  }

  // ─── Scheduled Posts ──────────────────────────────────────────────────────

  @Post('posts')
  @ApiOperation({ summary: 'Schedule a video post' })
  async schedulePost(
    @CurrentUser() user: { userId: string },
    @Body() dto: SchedulePostDto,
  ) {
    return this.publishService.schedulePost(user.userId, dto);
  }

  @Get('posts')
  @ApiOperation({ summary: 'List scheduled posts' })
  @ApiQuery({ name: 'status', enum: PostStatus, required: false })
  async listPosts(
    @CurrentUser() user: { userId: string },
    @Query('status') status?: PostStatus,
  ) {
    return this.publishService.listPosts(user.userId, status);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get a scheduled post' })
  async getPost(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.publishService.getPost(user.userId, postId);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Cancel a pending scheduled post' })
  async cancelPost(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    await this.publishService.cancelPost(user.userId, postId);
    return { success: true };
  }

  @Get('posts/:id/logs')
  @ApiOperation({ summary: 'Get upload logs for a scheduled post' })
  async getLogs(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.publishService.getLogs(user.userId, postId);
  }
}
