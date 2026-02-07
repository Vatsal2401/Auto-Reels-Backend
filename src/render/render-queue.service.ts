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
    music?: string;
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
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const url = this.configService.get<string>('REDIS_URL');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    this.logger.debug(
      `Redis Config Debug: host=${host}, port=${port}, hasPassword=${!!password}, hasUrl=${!!url}`,
    );

    if (!host && !url) {
      this.logger.error('Neither REDIS_HOST nor REDIS_URL is defined in environment variables');
      return;
    }

    const connectionOptions: any = host
      ? {
          host,
          port: port || 6379,
          password,
        }
      : {
          url,
        };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
      this.logger.log('Redis TLS enabled');
    }

    this.renderQueue = new Queue('render-tasks', {
      connection: connectionOptions,
    });

    this.logger.log(
      `RenderQueueService initialized with Redis connection (${host ? 'host:port' : 'url'})`,
    );

    this.renderQueue.on('error', (error) => {
      this.logger.error('Redis Queue Error:', error);
    });
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
