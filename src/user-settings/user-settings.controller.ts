import { Controller, Get, UseGuards } from '@nestjs/common';
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
    };
  }
}
