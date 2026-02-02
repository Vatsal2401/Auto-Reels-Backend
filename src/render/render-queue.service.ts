import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export interface RenderJobPayload {
  mediaId: string;
  stepId: string;
  userId: string;
  assets: {
    audio: string;
    caption: string;
    images: string[];
  };
  options: {
    preset: string;
    rendering_hints?: any;
  };
}

@Injectable()
export class RenderQueueService {
  private readonly logger = new Logger(RenderQueueService.name);
  private renderQueue: Queue;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.error('REDIS_URL is not defined in environment variables');
      return;
    }

    this.renderQueue = new Queue('render-tasks', {
      connection: {
        url: redisUrl,
      },
    });

    this.logger.log('RenderQueueService initialized with Redis connection');
  }

  async queueRenderJob(payload: RenderJobPayload): Promise<string> {
    try {
      const job = await this.renderQueue.add('render-video', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued render job: ${job.id} for media: ${payload.mediaId}`);
      return job.id as string;
    } catch (error) {
      this.logger.error(`Failed to queue render job for media ${payload.mediaId}:`, error);
      throw error;
    }
  }
}
