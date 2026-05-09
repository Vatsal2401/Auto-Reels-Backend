import { Module } from '@nestjs/common';
import { FFmpegRendererProvider } from './providers/ffmpeg-renderer.provider';
import { HyperFramesRendererProvider } from './providers/hyperframes-renderer.provider';
import { RenderQueueService } from './render-queue.service';
import { RemotionQueueService } from './remotion-queue.service';
import { RemotionKineticQueueService } from './remotion-kinetic-queue.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IVideoRenderer',
      useClass: FFmpegRendererProvider,
    },
    HyperFramesRendererProvider,
    RenderQueueService,
    RemotionQueueService,
    RemotionKineticQueueService,
  ],
  exports: [
    'IVideoRenderer',
    HyperFramesRendererProvider,
    RenderQueueService,
    RemotionQueueService,
    RemotionKineticQueueService,
  ],
})
export class RenderModule {}
