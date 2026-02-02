import { Module } from '@nestjs/common';
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
