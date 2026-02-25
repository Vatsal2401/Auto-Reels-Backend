import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsController } from './user-settings.controller';
import { SocialSchedulerEnabledGuard } from './guards/social-scheduler-enabled.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings])],
  providers: [UserSettingsService, SocialSchedulerEnabledGuard],
  controllers: [UserSettingsController],
  exports: [UserSettingsService, SocialSchedulerEnabledGuard],
})
export class UserSettingsModule {}
