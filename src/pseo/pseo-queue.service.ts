import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PseoPage, PseoPageStatus } from './entities/pseo-page.entity';
import { PseoContentService } from './services/pseo-content.service';
import { PseoValidatorService } from './services/pseo-validator.service';
import { PseoLinkingService } from './services/pseo-linking.service';
import {
  PSEO_QUEUE_NAME,
  PSEO_JOB_GENERATE,
  PSEO_JOB_VALIDATE,
  PSEO_JOB_LINK,
} from './pseo-queue.constants';

export interface PseoJobPayload {
  pageId: string;
}

@Injectable()
export class PseoQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PseoQueueService.name);
  private queue: Queue;
  private worker: Worker;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PseoPage)
    private readonly repo: Repository<PseoPage>,
    private readonly contentService: PseoContentService,
    private readonly validatorService: PseoValidatorService,
    private readonly linkingService: PseoLinkingService,
  ) {}

  onModuleInit() {
    const connection = this.buildConnection();

    // Gemini 2.0 Flash rate limits:
    //   Free tier:          15 RPM  →  PSEO_RPM default = 12  (safe buffer)
    //   Pay-as-you-go:    2000 RPM  →  set PSEO_RPM=100 in .env for faster bulk runs
    const rpm = parseInt(this.configService.get<string>('PSEO_RPM') || '12', 10) || 12;
    const concurrency = parseInt(this.configService.get<string>('PSEO_CONCURRENCY') || '2', 10) || 2;

    this.logger.log(`PSEO worker: concurrency=${concurrency}, rpm=${rpm} (Gemini free limit=15)`);

    this.queue = new Queue(PSEO_QUEUE_NAME, { connection });
    this.queue.on('error', (err) => this.logger.error('PSEO Queue error:', err));

    this.worker = new Worker(PSEO_QUEUE_NAME, (job: Job) => this.processJob(job), {
      connection,
      concurrency,
      limiter: { max: rpm, duration: 60_000 }, // max N jobs per 60 seconds = N RPM
    });

    this.worker.on('completed', (job) => this.logger.log(`Job ${job.id} (${job.name}) completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.id} (${job?.name}) failed: ${err.message}`),
    );
    this.logger.log('PSEO queue + worker initialised');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async addGenerateJob(pageId: string): Promise<string> {
    const job = await this.queue.add(
      PSEO_JOB_GENERATE,
      { pageId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    return job.id as string;
  }

  async addValidateJob(pageId: string): Promise<void> {
    await this.queue.add(
      PSEO_JOB_VALIDATE,
      { pageId },
      {
        attempts: 2,
        removeOnComplete: true,
      },
    );
  }

  async addLinkJob(pageId: string): Promise<void> {
    await this.queue.add(
      PSEO_JOB_LINK,
      { pageId },
      {
        attempts: 2,
        removeOnComplete: true,
      },
    );
  }

  async addManyGenerateJobs(pageIds: string[]): Promise<number> {
    const jobs = pageIds.map((pageId) => ({
      name: PSEO_JOB_GENERATE,
      data: { pageId },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }));
    await this.queue.addBulk(jobs);
    return jobs.length;
  }

  // ─── Job processor ────────────────────────────────────────────────────────

  private async processJob(job: Job<PseoJobPayload>): Promise<void> {
    switch (job.name) {
      case PSEO_JOB_GENERATE:
        return this.handleGenerate(job);
      case PSEO_JOB_VALIDATE:
        return this.handleValidate(job);
      case PSEO_JOB_LINK:
        return this.handleLink(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleGenerate(job: Job<PseoJobPayload>): Promise<void> {
    const { pageId } = job.data;
    const page = await this.repo.findOne({ where: { id: pageId } });
    if (!page) {
      this.logger.warn(`Page ${pageId} not found`);
      return;
    }
    if (page.status === PseoPageStatus.PUBLISHED) return;

    await this.repo.update(pageId, {
      status: PseoPageStatus.GENERATING,
      generation_attempts: page.generation_attempts + 1,
    });

    try {
      const content = await this.contentService.generateContent(page);
      const wordCount = JSON.stringify(content).split(/\s+/).filter(Boolean).length;

      await this.repo.update(pageId, {
        content,
        word_count: wordCount,
        status: PseoPageStatus.GENERATED,
        generation_error: null,
      });

      this.logger.log(`Generated ${page.slug} (${wordCount} words)`);
      await this.addValidateJob(pageId);
    } catch (err) {
      const isRateLimit =
        err.message?.includes('429') ||
        err.message?.toLowerCase().includes('quota') ||
        err.message?.toLowerCase().includes('rate');
      await this.repo.update(pageId, {
        // Keep as DRAFT on rate-limit so BullMQ retry can re-attempt cleanly
        status: isRateLimit ? PseoPageStatus.DRAFT : PseoPageStatus.FAILED,
        generation_error: err.message,
      });
      throw err; // BullMQ retries with exponential backoff (3 attempts, 2s base)
    }
  }

  private async handleValidate(job: Job<PseoJobPayload>): Promise<void> {
    const { pageId } = job.data;
    const page = await this.repo.findOne({ where: { id: pageId } });
    if (!page || page.status !== PseoPageStatus.GENERATED) return;

    await this.repo.update(pageId, { status: PseoPageStatus.VALIDATING });
    const result = await this.validatorService.validate(page);

    if (result.passed) {
      await this.repo.update(pageId, {
        quality_score: result.score,
        status: PseoPageStatus.GENERATED,
      });
      this.logger.log(`Validated ${page.slug} (score=${result.score})`);
    } else {
      await this.repo.update(pageId, {
        quality_score: result.score,
        status: PseoPageStatus.FAILED,
        generation_error: `Validation failed: ${result.reasons.join('; ')}`,
      });
      this.logger.warn(`Validation failed for ${page.slug}: ${result.reasons.join('; ')}`);
    }
  }

  private async handleLink(job: Job<PseoJobPayload>): Promise<void> {
    const { pageId } = job.data;
    const page = await this.repo.findOne({ where: { id: pageId } });
    if (!page) return;

    const links = await this.linkingService.computeLinks(page);
    await this.repo.update(pageId, { related_paths: links });
    await this.linkingService.updateReverseLinks(page, links);
    this.logger.log(`Computed ${links.length} links for ${page.slug}`);
  }

  // ─── Redis connection helper ───────────────────────────────────────────────

  private buildConnection(): any {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const url = this.configService.get<string>('REDIS_URL');
    const useTls = this.configService.get<string>('REDIS_TLS') === 'true';

    const conn: any = host ? { host, port: port || 6379, password } : { url };
    if (useTls) conn.tls = { rejectUnauthorized: false };
    return conn;
  }
}
