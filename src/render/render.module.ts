import { Module } from '@nestjs/common';
import { IVideoRenderer } from './interfaces/video-renderer.interface';
import { FFmpegRendererProvider } from './providers/ffmpeg-renderer.provider';

@Module({
  providers: [
    {
      provide: 'IVideoRenderer',
      useClass: FFmpegRendererProvider,
    },
  ],
  exports: ['IVideoRenderer'],
})
export class RenderModule {}
