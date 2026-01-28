import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { Video } from './entities/video.entity';
import { Job } from './entities/job.entity';
import { Asset } from './entities/asset.entity';
import { CreditsModule } from '../credits/credits.module';

import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { RenderModule } from '../render/render.module';
import { VideoGenerationService } from './video-generation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, Job, Asset]),
    CreditsModule,
    AIModule,
    StorageModule,
    RenderModule,
  ],
  controllers: [VideoController],
  providers: [VideoService, VideoGenerationService],
  exports: [VideoService],
})
export class VideoModule { }
