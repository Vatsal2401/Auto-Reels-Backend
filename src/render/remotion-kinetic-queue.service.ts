import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import type { WatermarkConfig } from './render-queue.service';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 5000;

export interface KineticJobPayload {
  projectId: string;
  userId: string;
  /** When set, worker uses this composition (e.g. GraphicMotionComposition). */
  compositionId?: string;
  /** Set by backend from user plan: FREE = watermark on, PRO = off. */
  monetization?: { watermark: WatermarkConfig };
  inputProps: {
    timeline?: Array<{
      text: string;
      words: string[];
      durationInFrames: number;
      animationPreset: string;
      highlightWordIndices?: number[];
    }>;
    graphicMotionTimeline?: unknown;
    width: number;
    height: number;
    fps?: number;
    fontFamily?: string;
  };
  /** Background music: blob storage id for worker to resolve to signed URL. */
  musicBlobId?: string;
  /** Background music volume 0–1. */
  musicVolume?: number;
}

@Injectable()
export class RemotionKineticQueueService {
  private readonly logger = new Logger(RemotionKineticQueueService.name);
  private queue: Queue | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const url = this.configService.get<string>('REDIS_URL');

    if (!host && !url) {
      this.logger.warn(
        'Neither REDIS_HOST nor REDIS_URL defined; Remotion Kinetic queue will not be available',
      );
      return;
    }

    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    const connectionOptions: any = host ? { host, port: port || 6379, password } : { url };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
    }

    this.queue = new Queue('remotion-kinetic-typography-tasks', {
      connection: connectionOptions,
    });

    this.queue.on('error', (error) => {
      this.logger.error('Remotion Kinetic Queue Redis Error:', error);
    });

    this.logger.log(`RemotionKineticQueueService initialized (remotion-kinetic-typography-tasks)`);
  }

  async queueKineticJob(payload: KineticJobPayload): Promise<string> {
    if (!this.queue) {
      throw new Error('Remotion Kinetic queue not configured (missing Redis connection)');
    }
    const attempts = this.configService.get<number>('REMOTION_JOB_ATTEMPTS') ?? DEFAULT_ATTEMPTS;
    const backoffDelay =
      this.configService.get<number>('REMOTION_JOB_BACKOFF_DELAY_MS') ?? DEFAULT_BACKOFF_DELAY_MS;

    try {
      const job = await this.queue.add('kinetic-render', payload, {
        attempts,
        backoff: { type: 'exponential', delay: backoffDelay },
        removeOnComplete: true,
        removeOnFail: false,
      });

      this.logger.log(`Queued kinetic job: ${job.id} for project: ${payload.projectId}`);
      return job.id as string;
    } catch (error) {
      this.logger.error(`Failed to queue kinetic job for project ${payload.projectId}:`, error);
      throw error;
    }
  }
}
