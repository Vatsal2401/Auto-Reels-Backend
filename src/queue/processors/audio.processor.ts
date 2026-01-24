import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { ITextToSpeech } from '../../ai/interfaces/text-to-speech.interface';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { QueueService } from '../queue.service';

@Processor('audio-generate')
@Injectable()
export class AudioProcessor extends WorkerHost {
  private readonly logger = new Logger(AudioProcessor.name);

  constructor(
    private videoService: VideoService,
    @Inject('ITextToSpeech')
    private textToSpeech: ITextToSpeech,
    @Inject('IStorageService')
    private storageService: IStorageService,
    private queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Generating audio for video ${video_id}`);

    try {
      const video = await this.videoService.getVideo(video_id);
      
      if (!video.script) {
        throw new Error('Script not found for video');
      }
      
      // Generate TTS
      const audioBuffer = await this.textToSpeech.textToSpeech(video.script);
      
      // Upload to storage
      const audioUrl = await this.storageService.uploadAudio(video_id, audioBuffer);
      
      // Update DB
      await this.videoService.updateAudioUrl(video_id, audioUrl);
      
      // Mark as ready for fan-in
      await this.queueService.markReady(video_id, 'audio');
      
      // Notify orchestrator
      await this.queueService.emit('audio:complete', video_id);
      
      this.logger.log(`Audio generated successfully for video ${video_id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error generating audio for video ${video_id}:`, error);
      await this.videoService.failVideo(video_id, `Audio generation failed: ${errorMessage}`);
      throw error;
    }
  }
}
