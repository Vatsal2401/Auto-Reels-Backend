import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private redis: Redis;

  constructor(
    @InjectQueue('video-create') public readonly videoQueue: Queue,
    @InjectQueue('script-generate') public readonly scriptQueue: Queue,
    @InjectQueue('audio-generate') public readonly audioQueue: Queue,
    @InjectQueue('caption-generate') public readonly captionQueue: Queue,
    @InjectQueue('asset-fetch') public readonly assetQueue: Queue,
    @InjectQueue('render-video') public readonly renderQueue: Queue,
    @InjectQueue('video-complete') public readonly completeQueue: Queue,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`, error.stack);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready');
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting');
    });
  }

  async emit(event: string, data: any): Promise<void> {
    // Publish event to Redis for orchestrator to listen
    await this.redis.publish(`events:${event}`, JSON.stringify(data));
  }

  async markReady(videoId: string, jobType: string): Promise<void> {
    await this.redis.sadd(`video:${videoId}:ready`, jobType);
  }

  async checkFanIn(videoId: string): Promise<boolean> {
    const count = await this.redis.scard(`video:${videoId}:ready`);
    return count >= 3; // audio, caption, asset
  }

  async clearReady(videoId: string): Promise<void> {
    await this.redis.del(`video:${videoId}:ready`);
  }
}
