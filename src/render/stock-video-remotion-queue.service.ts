import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { RenderJobPayload } from './render-queue.service';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 5000;

@Injectable()
export class StockVideoRemotionQueueService {
  private readonly logger = new Logger(StockVideoRemotionQueueService.name);
  private stockVideoQueue: Queue | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const url = this.configService.get<string>('REDIS_URL');

    if (!host && !url) {
      this.logger.warn(
        'Neither REDIS_HOST nor REDIS_URL defined; stock-video queue will not be available',
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

    this.stockVideoQueue = new Queue('stock-video-render-tasks', {
      connection: connectionOptions,
    });

    this.stockVideoQueue.on('error', (error) => {
      this.logger.error('Stock Video Queue Redis Error:', error);
    });

    this.logger.log(
      `StockVideoRemotionQueueService initialized (stock-video-render-tasks, ${host ? 'host:port' : 'url'})`,
    );
  }

  async queueStockVideoJob(payload: RenderJobPayload): Promise<string> {
    if (!this.stockVideoQueue) {
      throw new Error('Stock video queue not configured (missing Redis connection)');
    }

    const attempts = DEFAULT_ATTEMPTS;
    const backoffDelay = DEFAULT_BACKOFF_DELAY_MS;

    try {
      const job = await this.stockVideoQueue.add('stock-video-render', payload, {
        attempts,
        backoff: {
          type: 'exponential',
          delay: backoffDelay,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued stock-video job: ${job.id} for media: ${payload.mediaId}`);
      return job.id as string;
    } catch (error) {
      this.logger.error(`Failed to queue stock-video job for media ${payload.mediaId}:`, error);
      throw error;
    }
  }
}
