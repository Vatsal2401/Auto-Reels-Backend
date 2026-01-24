import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { QueueService } from '../queue.service';

@Processor('asset-fetch')
@Injectable()
export class AssetProcessor extends WorkerHost {
  private readonly logger = new Logger(AssetProcessor.name);

  constructor(
    private videoService: VideoService,
    @Inject('IStorageService')
    private storageService: IStorageService,
    private queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Fetching assets for video ${video_id}`);

    try {
      const video = await this.videoService.getVideo(video_id);
      
      // For MVP: Use placeholder/dummy assets
      // In production, integrate with stock video/image APIs (Pexels, Unsplash, etc.)
      const assetUrls: string[] = [];
      
      // Example: Fetch stock video based on topic
      // For now, we'll create a placeholder
      // TODO: Integrate with stock asset APIs
      const placeholderAsset = Buffer.from('placeholder'); // Replace with actual asset fetch
      const assetUrl = await this.storageService.uploadAsset(video_id, placeholderAsset, 'video/mp4');
      assetUrls.push(assetUrl);
      
      // Update DB
      await this.videoService.updateAssetUrls(video_id, assetUrls);
      
      // Mark as ready for fan-in
      await this.queueService.markReady(video_id, 'asset');
      
      // Notify orchestrator
      await this.queueService.emit('asset:complete', video_id);
      
      this.logger.log(`Assets fetched successfully for video ${video_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching assets for video ${video_id}:`, error);
      await this.videoService.failVideo(video_id, `Asset fetch failed: ${errorMessage}`);
      throw error;
    }
  }
}
