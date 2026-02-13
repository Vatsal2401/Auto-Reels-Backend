import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { RenderJobPayload } from './render-queue.service';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class RemotionQueueService {
  private readonly logger = new Logger(RemotionQueueService.name);
  private remotionQueue: Queue | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const url = this.configService.get<string>('REDIS_URL');

    if (!host && !url) {
      this.logger.warn(
        'Neither REDIS_HOST nor REDIS_URL defined; Remotion queue will not be available',
      );
      return;
    }

    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    const connectionOptions: any = host
      ? {
          host,
          port: port || 6379,
          password,
        }
      : { url };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
    }

    this.remotionQueue = new Queue('remotion-render-tasks', {
      connection: connectionOptions,
    });

    this.remotionQueue.on('error', (error) => {
      this.logger.error('Remotion Queue Redis Error:', error);
    });

    this.logger.log(
      `RemotionQueueService initialized (remotion-render-tasks, ${host ? 'host:port' : 'url'})`,
    );
  }

  async queueRemotionJob(payload: RenderJobPayload): Promise<string> {
    if (!this.remotionQueue) {
      throw new Error('Remotion queue not configured (missing Redis connection)');
    }
    const attempts = this.configService.get<number>('REMOTION_JOB_ATTEMPTS') ?? DEFAULT_ATTEMPTS;
    const backoffDelay =
      this.configService.get<number>('REMOTION_JOB_BACKOFF_DELAY_MS') ?? DEFAULT_BACKOFF_DELAY_MS;

    try {
      const job = await this.remotionQueue.add('remotion-render', payload, {
        attempts,
        backoff: {
          type: 'exponential',
          delay: backoffDelay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued remotion job: ${job.id} for media: ${payload.mediaId}`);
      return job.id as string;
    } catch (error) {
      this.logger.error(`Failed to queue remotion job for media ${payload.mediaId}:`, error);
      throw error;
    }
  }
}
