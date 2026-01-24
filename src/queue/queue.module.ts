import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { OrchestratorProcessor } from './processors/orchestrator.processor';
import { ScriptProcessor } from './processors/script.processor';
import { AudioProcessor } from './processors/audio.processor';
import { CaptionProcessor } from './processors/caption.processor';
import { AssetProcessor } from './processors/asset.processor';
import { RenderProcessor } from './processors/render.processor';
import { VideoModule } from '../video/video.module';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { RenderModule } from '../render/render.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-create' }),
    BullModule.registerQueue({ name: 'script-generate' }),
    BullModule.registerQueue({ name: 'audio-generate' }),
    BullModule.registerQueue({ name: 'caption-generate' }),
    BullModule.registerQueue({ name: 'asset-fetch' }),
    BullModule.registerQueue({ name: 'render-video' }),
    BullModule.registerQueue({ name: 'video-complete' }),
    forwardRef(() => VideoModule),
    AIModule,
    StorageModule,
    RenderModule,
  ],
  providers: [
    QueueService,
    OrchestratorProcessor,
    ScriptProcessor,
    AudioProcessor,
    CaptionProcessor,
    AssetProcessor,
    RenderProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}
