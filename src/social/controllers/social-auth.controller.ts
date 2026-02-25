import { Controller, Get, Query, UseGuards, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SocialSchedulerEnabledGuard } from '../../user-settings/guards/social-scheduler-enabled.guard';
import { SocialAuthService } from '../services/social-auth.service';

@ApiTags('social')
@ApiBearerAuth()
@Controller('social/connect')
@UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(private readonly socialAuthService: SocialAuthService) {}

  // ─── YouTube ─────────────────────────────────────────────────────────────

  @Get('youtube')
  @ApiOperation({ summary: 'Initiate YouTube OAuth — redirects to Google' })
  async connectYouTube(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = this.socialAuthService.generateYouTubeAuthUrl(user.userId);
    return res.redirect(url);
  }

  @Get('youtube/callback')
  @ApiOperation({ summary: 'YouTube OAuth callback' })
  async youTubeCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleYouTubeCallback(code, state);
    return res.redirect('/social/accounts?connected=youtube');
  }

  // ─── TikTok ──────────────────────────────────────────────────────────────

  @Get('tiktok')
  @ApiOperation({ summary: 'Initiate TikTok OAuth with PKCE' })
  async connectTikTok(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = await this.socialAuthService.generateTikTokAuthUrl(user.userId);
    return res.redirect(url);
  }

  @Get('tiktok/callback')
  @ApiOperation({ summary: 'TikTok OAuth callback' })
  async tikTokCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleTikTokCallback(code, state);
    return res.redirect('/social/accounts?connected=tiktok');
  }

  // ─── Instagram ───────────────────────────────────────────────────────────

  @Get('instagram')
  @ApiOperation({ summary: 'Initiate Instagram OAuth — exchanges for long-lived token' })
  async connectInstagram(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = this.socialAuthService.generateInstagramAuthUrl(user.userId);
    return res.redirect(url);
  }

  @Get('instagram/callback')
  @ApiOperation({ summary: 'Instagram OAuth callback' })
  async instagramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleInstagramCallback(code, state);
    return res.redirect('/social/accounts?connected=instagram');
  }
}
