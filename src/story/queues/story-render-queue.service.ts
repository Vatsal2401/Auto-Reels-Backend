import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { StoryScriptJSON } from '../interfaces/story-script.interface';

export interface StoryRenderJobPayload {
  mediaId: string;
  stepId: string;
  userId: string;
  scenes: Array<{
    subtitle: string;
    duration_seconds: number;
    camera_motion: string;
  }>;
  assets: {
    images: string[];
    audio: string;
    caption: string;
    music?: string;
  };
  watermark?: { enabled: boolean; type: 'text' | 'image'; value?: string };
}

@Injectable()
export class StoryRenderQueueService {
  private readonly logger = new Logger(StoryRenderQueueService.name);
  private storyQueue: Queue;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const url = this.configService.get<string>('REDIS_URL');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    if (!host && !url) {
      this.logger.error('Neither REDIS_HOST nor REDIS_URL is defined');
      return;
    }

    const connectionOptions: any = host
      ? { host, port: port || 6379, password }
      : { url };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
    }

    this.storyQueue = new Queue('story-render-tasks', {
      connection: connectionOptions,
    });

    this.storyQueue.on('error', (error) => {
      this.logger.error('Story Queue Error:', error);
    });

    this.logger.log('StoryRenderQueueService initialized');
  }

  async queueStoryRenderJob(payload: StoryRenderJobPayload): Promise<string> {
    const job = await this.storyQueue.add('story-render-video', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Queued story render job: ${job.id} for media: ${payload.mediaId}`);
    return job.id as string;
  }
}
