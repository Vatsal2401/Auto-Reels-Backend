import { Controller, Get, Query, UseGuards, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SocialSchedulerEnabledGuard } from '../../user-settings/guards/social-scheduler-enabled.guard';
import { SocialAuthService } from '../services/social-auth.service';

@ApiTags('social')
@ApiBearerAuth()
@Controller('social/connect')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly socialAuthService: SocialAuthService,
    private readonly configService: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return process.env.FRONTEND_URL || this.configService.get<string>('frontendUrl') || 'http://localhost:3001';
  }

  // ─── YouTube ─────────────────────────────────────────────────────────────

  @Get('youtube/url')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Return YouTube OAuth URL as JSON (for SPA redirect)' })
  async youTubeAuthUrl(@CurrentUser() user: { userId: string }) {
    return { url: this.socialAuthService.generateYouTubeAuthUrl(user.userId) };
  }

  @Get('youtube')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Initiate YouTube OAuth — redirects to Google' })
  async connectYouTube(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = this.socialAuthService.generateYouTubeAuthUrl(user.userId);
    return res.redirect(url);
  }

  /** Public — Google redirects here; user identity extracted from signed state JWT */
  @Get('youtube/callback')
  @ApiOperation({ summary: 'YouTube OAuth callback (public — no JWT header from Google)' })
  async youTubeCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleYouTubeCallback(code, state);
    return res.redirect(`${this.frontendUrl}/social/accounts?connected=youtube`);
  }

  // ─── TikTok ──────────────────────────────────────────────────────────────

  @Get('tiktok/url')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Return TikTok OAuth URL as JSON (for SPA redirect)' })
  async tikTokAuthUrl(@CurrentUser() user: { userId: string }) {
    return { url: await this.socialAuthService.generateTikTokAuthUrl(user.userId) };
  }

  @Get('tiktok')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Initiate TikTok OAuth with PKCE' })
  async connectTikTok(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = await this.socialAuthService.generateTikTokAuthUrl(user.userId);
    return res.redirect(url);
  }

  /** Public — TikTok redirects here; user identity extracted from signed state JWT */
  @Get('tiktok/callback')
  @ApiOperation({ summary: 'TikTok OAuth callback (public — no JWT header from TikTok)' })
  async tikTokCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleTikTokCallback(code, state);
    return res.redirect(`${this.frontendUrl}/social/accounts?connected=tiktok`);
  }

  // ─── Instagram ───────────────────────────────────────────────────────────

  @Get('instagram/url')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Return Instagram OAuth URL as JSON (for SPA redirect)' })
  async instagramAuthUrl(@CurrentUser() user: { userId: string }) {
    return { url: this.socialAuthService.generateInstagramAuthUrl(user.userId) };
  }

  @Get('instagram')
  @UseGuards(JwtAuthGuard, SocialSchedulerEnabledGuard)
  @ApiOperation({ summary: 'Initiate Instagram OAuth — exchanges for long-lived token' })
  async connectInstagram(
    @CurrentUser() user: { userId: string },
    @Res() res: Response,
  ) {
    const url = this.socialAuthService.generateInstagramAuthUrl(user.userId);
    return res.redirect(url);
  }

  /** Public — Meta redirects here; user identity extracted from signed state JWT */
  @Get('instagram/callback')
  @ApiOperation({ summary: 'Instagram OAuth callback (public — no JWT header from Meta)' })
  async instagramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.socialAuthService.handleInstagramCallback(code, state);
    return res.redirect(`${this.frontendUrl}/social/accounts?connected=instagram`);
  }
}
