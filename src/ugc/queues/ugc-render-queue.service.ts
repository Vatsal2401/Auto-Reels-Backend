import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { UgcScene } from '../services/ugc-script.service';

export interface UgcBrollAsset {
  s3Key: string;
  durationSeconds: number | null;
  pexelsUrl?: string;
  sceneNumber: number;
}

export interface UgcRenderJobPayload {
  mediaId: string;
  stepId: string;
  userId: string;
  assets: {
    actorVideo: string; // S3 key for Hedra-generated actor video
    voice: string; // S3 key for ElevenLabs VO audio
    brollClips: UgcBrollAsset[];
    music?: string; // S3 key for background music
  };
  scenes: UgcScene[];
  options: {
    musicVolume?: number;
  };
  monetization?: {
    watermark: { enabled: boolean; type: 'text' | 'image'; value?: string };
  };
}

@Injectable()
export class UgcRenderQueueService {
  private readonly logger = new Logger(UgcRenderQueueService.name);
  private ugcQueue: Queue;

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

    const connectionOptions: any = host ? { host, port: port || 6379, password } : { url };

    if (useTls) {
      connectionOptions.tls = { rejectUnauthorized: false };
    }

    this.ugcQueue = new Queue('ugc-render-tasks', {
      connection: connectionOptions,
    });

    this.ugcQueue.on('error', (error) => {
      this.logger.error('UGC Queue Error:', error);
    });

    this.logger.log('UgcRenderQueueService initialized');
  }

  async queueUgcRenderJob(payload: UgcRenderJobPayload): Promise<string> {
    const job = await this.ugcQueue.add('ugc-render-video', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.logger.log(`Queued UGC render job: ${job.id} for media: ${payload.mediaId}`);
    return job.id as string;
  }
}
