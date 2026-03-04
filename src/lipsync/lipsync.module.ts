import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { LipSyncService } from './lipsync.service';
import { LipSyncController } from './lipsync.controller';
import { LipSyncEnabledGuard } from './guards/lipsync-enabled.guard';

@Module({
  imports: [ConfigModule, UserSettingsModule],
  providers: [LipSyncService, LipSyncEnabledGuard],
  controllers: [LipSyncController],
})
export class LipSyncModule {}
