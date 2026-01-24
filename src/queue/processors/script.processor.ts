import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { IScriptGenerator } from '../../ai/interfaces/script-generator.interface';
import { QueueService } from '../queue.service';

@Processor('script-generate')
@Injectable()
export class ScriptProcessor extends WorkerHost {
  private readonly logger = new Logger(ScriptProcessor.name);

  constructor(
    private videoService: VideoService,
    @Inject('IScriptGenerator')
    private scriptGenerator: IScriptGenerator,
    private queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Generating script for video ${video_id}`);

    try {
      const video = await this.videoService.getVideo(video_id);
      
      // Generate script
      const script = await this.scriptGenerator.generateScript(video.topic);
      
      // Save to DB
      await this.videoService.updateScript(video_id, script);
      
      // Trigger fan-out
      await this.queueService.emit('script:complete', video_id);
      
      this.logger.log(`Script generated successfully for video ${video_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error generating script for video ${video_id}:`, error);
      await this.videoService.failVideo(video_id, `Script generation failed: ${errorMessage}`);
      throw error;
    }
  }
}
