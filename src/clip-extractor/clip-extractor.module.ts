import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClipExtractJob } from './entities/clip-extract-job.entity';
import { ExtractedClip } from './entities/extracted-clip.entity';
import { ClipExtractorService } from './services/clip-extractor.service';
import { ClipExtractorController } from './clip-extractor.controller';
import { ClipExtractQueueService } from './queues/clip-extract-queue.service';
import { ClipExtractorEnabledGuard } from './guards/clip-extractor-enabled.guard';
import { CreditsModule } from '../credits/credits.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClipExtractJob, ExtractedClip]),
    CreditsModule,
    UserSettingsModule,
    StorageModule,
  ],
  controllers: [ClipExtractorController],
  providers: [ClipExtractorService, ClipExtractQueueService, ClipExtractorEnabledGuard],
  exports: [ClipExtractorService],
})
export class ClipExtractorModule {}
