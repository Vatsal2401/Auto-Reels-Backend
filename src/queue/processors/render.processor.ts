import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { IVideoRenderer } from '../../render/interfaces/video-renderer.interface';
import { IStorageService } from '../../storage/interfaces/storage.interface';

@Processor('render-video')
@Injectable()
export class RenderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenderProcessor.name);

  constructor(
    private videoService: VideoService,
    @Inject('IVideoRenderer')
    private videoRenderer: IVideoRenderer,
    @Inject('IStorageService')
    private storageService: IStorageService,
  ) {
    super();
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Rendering video ${video_id}`);

    try {
      const video = await this.videoService.getVideo(video_id);
      
      if (!video.audio_url || !video.caption_url || !video.asset_urls || video.asset_urls.length === 0) {
        throw new Error('Missing required assets for rendering');
      }
      
      // Download assets from storage
      const [audio, caption, assets] = await Promise.all([
        this.storageService.download(video.audio_url),
        this.storageService.download(video.caption_url),
        this.storageService.downloadMultiple(video.asset_urls),
      ]);
      
      // Render video
      const videoBuffer = await this.videoRenderer.compose({
        audio,
        caption,
        assets,
        duration: video.metadata?.duration || 30,
      });
      
      // Upload final video
      const finalUrl = await this.storageService.uploadVideo(video_id, videoBuffer);
      
      // Update DB
      await this.videoService.completeVideo(video_id, finalUrl);
      
      this.logger.log(`Video rendered successfully for video ${video_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error rendering video ${video_id}:`, error);
      await this.videoService.failVideo(video_id, `Video rendering failed: ${errorMessage}`);
      throw error;
    }
  }
}
