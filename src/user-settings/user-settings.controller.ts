import { Controller, Get, Post, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSettingsService } from './user-settings.service';

@ApiTags('user-settings')
@ApiBearerAuth()
@Controller('user-settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user settings including feature flags' })
  async getSettings(@CurrentUser() user: { userId: string }) {
    const s = await this.userSettingsService.getOrCreate(user.userId);
    return {
      social_media_scheduler_enabled: s.social_media_scheduler_enabled,
      has_completed_onboarding: s.has_completed_onboarding,
      image_to_video_enabled: s.image_to_video_enabled,
      lipsync_enabled: s.lipsync_enabled,
      ugc_enabled: s.ugc_enabled,
      story_reel_enabled: s.story_reel_enabled,
      broll_enabled: s.broll_enabled,
      clip_extractor_enabled: s.clip_extractor_enabled,
    };
  }

  @Post('complete-onboarding')
  @ApiOperation({ summary: 'Mark onboarding as completed for the current user' })
  @HttpCode(204)
  async completeOnboarding(@CurrentUser() user: { userId: string }): Promise<void> {
    await this.userSettingsService.markOnboardingCompleted(user.userId);
  }
}
