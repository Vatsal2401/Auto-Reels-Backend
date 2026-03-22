import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClipExtractJob,
  ClipExtractStatus,
  ClipExtractOptions,
} from '../entities/clip-extract-job.entity';
import { ExtractedClip } from '../entities/extracted-clip.entity';
import { CreateClipExtractJobDto } from '../dto/create-clip-extract-job.dto';
import {
  ClipExtractQueueService,
  ClipExtractJobPayload,
} from '../queues/clip-extract-queue.service';
import { CreditsService } from '../../credits/credits.service';
import { TransactionType } from '../../credits/entities/credit-transaction.entity';
import { validateSourceUrl } from '../validators/source-url.validator';

export const CLIP_EXTRACTOR_CREDIT_COST_PER_CLIP = 1;
export const CLIP_EXTRACTOR_MAX_CREDITS_PER_JOB = 5;

@Injectable()
export class ClipExtractorService {
  private readonly logger = new Logger(ClipExtractorService.name);

  constructor(
    @InjectRepository(ClipExtractJob)
    private readonly jobRepo: Repository<ClipExtractJob>,
    @InjectRepository(ExtractedClip)
    private readonly clipRepo: Repository<ExtractedClip>,
    private readonly queueService: ClipExtractQueueService,
    private readonly creditsService: CreditsService,
  ) {}

  async createJob(
    dto: CreateClipExtractJobDto,
    userId: string,
    isPremium: boolean,
  ): Promise<{ id: string; creditsDeducted: number }> {
    // Validate + sanitize URL (SSRF prevention)
    const safeUrl = validateSourceUrl(dto.sourceUrl);

    const maxClips = Math.min(dto.maxClips ?? 5, CLIP_EXTRACTOR_MAX_CREDITS_PER_JOB);
    const cost = maxClips * CLIP_EXTRACTOR_CREDIT_COST_PER_CLIP;

    // Pre-check credits
    const hasCredits = await this.creditsService.hasEnoughCredits(userId, cost);
    if (!hasCredits) {
      throw new BadRequestException(`Insufficient credits. This job requires ${cost} credits.`);
    }

    const options: ClipExtractOptions = {
      maxClips,
      minClipSec: dto.minClipSec ?? 30,
      maxClipSec: dto.maxClipSec ?? 90,
      removeSilence: dto.removeSilence ?? true,
      captionStyle: dto.captionStyle ?? 'bold',
      splitScreenBroll: dto.splitScreenBroll ?? false,
      brollLibraryId: dto.brollLibraryId,
    };

    // Create DB row first
    const job = this.jobRepo.create({
      user_id: userId,
      source_url: safeUrl,
      status: ClipExtractStatus.PENDING,
      options,
      credits_reserved: cost,
      is_premium: isPremium,
    });
    const saved = await this.jobRepo.save(job);

    // Reserve credits immediately (refunded on failure)
    await this.creditsService.deductCredits(
      userId,
      cost,
      `Clip extraction reserved (${maxClips} clips)`,
      saved.id,
      { jobId: saved.id, status: 'reserved' },
    );

    // Enqueue BullMQ job
    const payload: ClipExtractJobPayload = {
      jobId: saved.id,
      userId,
      sourceUrl: safeUrl,
      options: options as Required<ClipExtractOptions>,
      creditsReserved: cost,
      isPremium,
    };

    await this.queueService.queueClipExtractJob(payload, isPremium);

    this.logger.log(
      `Created clip extract job ${saved.id} for user ${userId} (cost=${cost} credits)`,
    );

    return { id: saved.id, creditsDeducted: cost };
  }

  async getJob(jobId: string, userId: string): Promise<ClipExtractJob> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, user_id: userId },
      relations: ['clips'],
      order: { clips: { clip_index: 'ASC' } },
    });
    if (!job) throw new NotFoundException('Clip extraction job not found');
    return job;
  }

  async listJobs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ClipExtractJob[]; total: number }> {
    const [items, total] = await this.jobRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return { items, total };
  }

  async getClips(jobId: string, userId: string): Promise<ExtractedClip[]> {
    const job = await this.jobRepo.findOneBy({ id: jobId, user_id: userId });
    if (!job) throw new NotFoundException('Clip extraction job not found');

    return this.clipRepo.find({
      where: { job_id: jobId },
      order: { viral_score: 'DESC' },
    });
  }

  async getClipById(clipId: string, userId: string): Promise<ExtractedClip> {
    const clip = await this.clipRepo.findOne({
      where: { id: clipId },
      relations: ['job'],
    });
    if (!clip || clip.job?.user_id !== userId) {
      throw new NotFoundException('Clip not found');
    }
    return clip;
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.jobRepo.findOneBy({ id: jobId, user_id: userId });
    if (!job) throw new NotFoundException('Clip extraction job not found');

    // Only allow deletion of pending/failed jobs
    if (
      job.status !== ClipExtractStatus.PENDING &&
      job.status !== ClipExtractStatus.FAILED &&
      job.status !== ClipExtractStatus.COMPLETED
    ) {
      throw new ForbiddenException('Cannot delete a job that is currently processing');
    }

    // Refund reserved credits for pending/failed jobs
    if (job.status === ClipExtractStatus.PENDING || job.status === ClipExtractStatus.FAILED) {
      if (job.credits_reserved > 0) {
        try {
          await this.creditsService.addCredits(
            userId,
            job.credits_reserved,
            TransactionType.REFUND,
            `Clip extraction refund (job deleted)`,
            jobId,
            { jobId, reason: 'job_deleted' },
          );
        } catch (err) {
          this.logger.error(`Failed to refund credits for job ${jobId}:`, err);
        }
      }
    }

    await this.jobRepo.delete({ id: jobId, user_id: userId });
    this.logger.log(`Deleted clip extract job ${jobId} for user ${userId}`);
  }
}
