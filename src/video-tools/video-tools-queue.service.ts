import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

const QUEUE_NAME = 'video-tools-tasks';
const DEFAULT_ATTEMPTS = 2;
const DEFAULT_BACKOFF_DELAY_MS = 5000;

export type VideoToolType = 'video-resize' | 'video-compress';

export interface VideoResizeOptions {
  width: number;
  height: number;
  fit: 'fill' | 'contain' | 'cover';
}

export interface VideoCompressOptions {
  width: number;
  height: number;
  crf: number;
  presetLabel: string;
}

export interface VideoToolsJobPayload {
  projectId: string;
  userId: string;
  inputBlobId: string;
  toolType: VideoToolType;
  options: VideoResizeOptions | VideoCompressOptions;
  outputFileName: string;
}

@Injectable()
export class VideoToolsQueueService {
  private readonly logger = new Logger(VideoToolsQueueService.name);
  private queue: Queue<VideoToolsJobPayload> | null = null;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const url = this.configService.get<string>('REDIS_URL');

    if (!host && !url) {
      this.logger.warn(
        'Neither REDIS_HOST nor REDIS_URL defined; video-tools queue will not be available',
      );
      return;
    }

    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    const connectionOptions: Record<string, unknown> = host
      ? { host, port: port || 6379, password }
      : { url };

    if (useTls) {
      (connectionOptions as any).tls = { rejectUnauthorized: false };
    }

    this.queue = new Queue<VideoToolsJobPayload>(QUEUE_NAME, {
      connection: connectionOptions,
    });

    this.queue.on('error', (error) => {
      this.logger.error('Video tools queue Redis error:', error);
    });

    this.logger.log(`VideoToolsQueueService initialized (${QUEUE_NAME})`);
  }

  async addJob(payload: VideoToolsJobPayload): Promise<string> {
    if (!this.queue) {
      throw new Error('Video tools queue not configured (missing Redis connection)');
    }
    const attempts = this.configService.get<number>('VIDEO_TOOLS_JOB_ATTEMPTS') ?? DEFAULT_ATTEMPTS;
    const backoffDelay =
      this.configService.get<number>('VIDEO_TOOLS_JOB_BACKOFF_MS') ?? DEFAULT_BACKOFF_DELAY_MS;

    const job = await this.queue.add(payload.toolType, payload, {
      attempts,
      backoff: { type: 'exponential', delay: backoffDelay },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`Queued video-tools job: ${job.id} for project: ${payload.projectId}`);
    return job.id as string;
  }

  async getWaitingCount(): Promise<number> {
    if (!this.queue) return 0;
    return this.queue.getWaitingCount();
  }
}
