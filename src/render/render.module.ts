import { Module } from '@nestjs/common';
import { FFmpegRendererProvider } from './providers/ffmpeg-renderer.provider';
import { RenderQueueService } from './render-queue.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IVideoRenderer',
      useClass: FFmpegRendererProvider,
    },
    RenderQueueService,
  ],
  exports: ['IVideoRenderer', RenderQueueService],
})
export class RenderModule {}
