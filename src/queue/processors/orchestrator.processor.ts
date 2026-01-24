import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { VideoService } from '../../video/video.service';
import { QueueService } from '../queue.service';
import { VideoStatus } from '../../video/entities/video.entity';
import Redis from 'ioredis';

@Processor('video-create')
@Injectable()
export class OrchestratorProcessor extends WorkerHost {
  private readonly logger = new Logger(OrchestratorProcessor.name);
  private redis: Redis;
  private subscriber: Redis;

  constructor(
    private videoService: VideoService,
    private queueService: QueueService,
  ) {
    super();
    
    const redisConfig = {
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
    };

    this.redis = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);

    // Add error handlers for redis
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

    // Add error handlers for subscriber
    this.subscriber.on('error', (error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`, error.stack);
    });

    this.subscriber.on('connect', () => {
      this.logger.log('Redis subscriber connected');
    });

    this.subscriber.on('ready', () => {
      this.logger.log('Redis subscriber ready');
    });

    this.subscriber.on('close', () => {
      this.logger.warn('Redis subscriber connection closed');
    });

    this.subscriber.on('reconnecting', () => {
      this.logger.log('Redis subscriber reconnecting');
    });

    // Listen for worker completion events
    this.subscriber.psubscribe('events:*');
    this.subscriber.on('pmessage', async (pattern, channel, message) => {
      try {
        const event = channel.replace('events:', '');
        const data = JSON.parse(message);

        if (event === 'script:complete') {
          await this.handleScriptComplete(data);
        } else if (event === 'audio:complete' || event === 'caption:complete' || event === 'asset:complete') {
          const jobType = event.split(':')[0];
          await this.handleWorkerComplete(data, jobType);
        }
      } catch (error) {
        this.logger.error(`Error handling event: ${error.message}`, error.stack);
      }
    });
  }

  async process(job: Job<{ video_id: string }>) {
    const { video_id } = job.data;
    this.logger.log(`Processing video creation for ${video_id}`);

    // Enqueue script generation
    await this.queueService.scriptQueue.add(
      'generate',
      { video_id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    await this.videoService.updateStatus(video_id, VideoStatus.SCRIPT_GENERATING);
  }

  private async handleScriptComplete(videoId: string) {
    this.logger.log(`Script complete for ${videoId}, triggering fan-out`);
    
    // Fan-out: Enqueue 3 parallel jobs
    await Promise.all([
      this.queueService.audioQueue.add(
        'generate',
        { video_id: videoId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      ),
      this.queueService.captionQueue.add(
        'generate',
        { video_id: videoId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      ),
      this.queueService.assetQueue.add(
        'fetch',
        { video_id: videoId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      ),
    ]);

    await this.videoService.updateStatus(videoId, VideoStatus.PROCESSING);
  }

  private async handleWorkerComplete(videoId: string, jobType: string) {
    this.logger.log(`Worker ${jobType} complete for ${videoId}`);
    
    // Mark as ready
    await this.queueService.markReady(videoId, jobType);
    
    // Check if all ready (fan-in)
    const allReady = await this.queueService.checkFanIn(videoId);
    
    if (allReady) {
      this.logger.log(`All workers complete for ${videoId}, enqueueing render`);
      await this.queueService.renderQueue.add(
        'render',
        { video_id: videoId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        },
      );
      await this.videoService.updateStatus(videoId, VideoStatus.RENDERING);
      await this.queueService.clearReady(videoId);
    }
  }
}
