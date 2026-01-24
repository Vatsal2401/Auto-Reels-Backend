import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { ICaptionGenerator } from '../../ai/interfaces/caption-generator.interface';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { QueueService } from '../queue.service';

@Processor('caption-generate')
@Injectable()
export class CaptionProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionProcessor.name);

  constructor(
    private videoService: VideoService,
    @Inject('ICaptionGenerator')
    private captionGenerator: ICaptionGenerator,
    @Inject('IStorageService')
    private storageService: IStorageService,
    private queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Generating caption for video ${video_id}`);

    try {
      const video = await this.videoService.getVideo(video_id);
      
      if (!video.script) {
        throw new Error('Script not found for video');
      }
      
      // Generate captions
      const captionBuffer = await this.captionGenerator.generateCaptions(video.script);
      
      // Upload to storage
      const captionUrl = await this.storageService.uploadCaption(video_id, captionBuffer);
      
      // Update DB
      await this.videoService.updateCaptionUrl(video_id, captionUrl);
      
      // Mark as ready for fan-in
      await this.queueService.markReady(video_id, 'caption');
      
      // Notify orchestrator
      await this.queueService.emit('caption:complete', video_id);
      
      this.logger.log(`Caption generated successfully for video ${video_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error generating caption for video ${video_id}:`, error);
      await this.videoService.failVideo(video_id, `Caption generation failed: ${errorMessage}`);
      throw error;
    }
  }
}
