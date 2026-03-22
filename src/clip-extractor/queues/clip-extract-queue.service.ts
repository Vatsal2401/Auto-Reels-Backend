import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ClipExtractOptions } from '../entities/clip-extract-job.entity';

export const CLIP_EXTRACT_QUEUE = 'clip-extract-tasks';

export interface ClipExtractJobPayload {
  jobId: string;
  userId: string;
  sourceUrl: string;
  options: Required<ClipExtractOptions>;
  creditsReserved: number;
  isPremium: boolean;
}

@Injectable()
export class ClipExtractQueueService {
  private readonly logger = new Logger(ClipExtractQueueService.name);
  private clipQueue: Queue;

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

    const connectionOptions: Record<string, unknown> = host
      ? { host, port: port || 6379, password }
      : { url };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
    }

    this.clipQueue = new Queue(CLIP_EXTRACT_QUEUE, {
      connection: connectionOptions,
    });

    this.clipQueue.on('error', (error) => {
      this.logger.error('Clip Extract Queue Error:', error);
    });

    this.logger.log('ClipExtractQueueService initialized');
  }

  async queueClipExtractJob(payload: ClipExtractJobPayload, isPremium: boolean): Promise<string> {
    const job = await this.clipQueue.add('clip-extract', payload, {
      priority: isPremium ? 10 : 5,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(
      `Queued clip extract job: ${job.id} for clipJob: ${payload.jobId} (premium=${isPremium})`,
    );
    return job.id as string;
  }
}
