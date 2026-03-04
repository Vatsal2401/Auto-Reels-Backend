import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsController } from './user-settings.controller';
import { SocialSchedulerEnabledGuard } from './guards/social-scheduler-enabled.guard';
import { UgcEnabledGuard } from './guards/ugc-enabled.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  providers: [UserSettingsService, SocialSchedulerEnabledGuard, UgcEnabledGuard],
  controllers: [UserSettingsController],
  exports: [UserSettingsService, SocialSchedulerEnabledGuard, UgcEnabledGuard],
})
export class UserSettingsModule {}
