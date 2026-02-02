import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './entities/media.entity';
import { MediaStep, StepStatus } from './entities/media-step.entity';
import { MediaAsset } from './entities/media-asset.entity';
import {
  MEDIA_FLOWS,
  MediaStatus,
  MediaType,
  MediaAssetType,
  CREDIT_COSTS,
} from './media.constants';
import { CreditsService } from '../credits/credits.service';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class MediaService {
  private readonly CREDITS_PER_MEDIA = 1;

  constructor(
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    @InjectRepository(MediaStep)
    private stepRepository: Repository<MediaStep>,
    @InjectRepository(MediaAsset)
    private assetRepository: Repository<MediaAsset>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private creditsService: CreditsService,
    @Inject('IStorageService') private storageService: IStorageService,
  ) {}

  async createMedia(dto: any, userId?: string): Promise<Media> {
    const topic = dto.topic || '';
    const wordCount = topic
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const charCount = topic.length;

    if (charCount < 45 || wordCount < 8) {
      throw new BadRequestException(
        `Creative intent is too short. Please provide at least 45 characters and 8 words to help the AI generate a high-quality video. (Current: ${charCount} chars, ${wordCount} words)`,
      );
    }

    const flowKey = dto.flowKey || 'videoMotion';
    const flow = MEDIA_FLOWS[flowKey];

    if (!flow) {
      throw new BadRequestException(`Invalid flow_key: ${flowKey}`);
    }

    const duration = dto.duration || '30-60';
    const creditCost = CREDIT_COSTS[duration] || CREDIT_COSTS['default'];

    // Credit check
    if (userId) {
      const hasEnoughCredits = await this.creditsService.hasEnoughCredits(userId, creditCost);
      if (!hasEnoughCredits) {
        throw new BadRequestException(
          `Insufficient credits. This request requires ${creditCost} credits.`,
        );
      }
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user && !user.email_verified) {
        throw new BadRequestException('Email verification required.');
      }
    }

    // Create Media record
    const media = this.mediaRepository.create({
      type: dto.type || MediaType.VIDEO,
      flow_key: flowKey,
      status: MediaStatus.PENDING,
      user_id: userId || null,
      input_config: dto,
    });

    const savedMedia = await this.mediaRepository.save(media);

    // Create Steps based on flow
    const steps = flow.steps.map((stepName) => {
      return this.stepRepository.create({
        media_id: savedMedia.id,
        step: stepName,
        status: StepStatus.PENDING,
        depends_on: flow.dependencies[stepName] || [],
        retry_count: 0,
      });
    });

    await this.stepRepository.save(steps);

    return savedMedia;
  }

  async getMedia(id: string): Promise<any> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps', 'assets'],
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    return await this.transformMedia(media);
  }

  async getUserMedia(userId: string): Promise<any[]> {
    const mediaList = await this.mediaRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['steps'],
    });

    return await Promise.all(mediaList.map((m) => this.transformMedia(m)));
  }

  async retryMedia(id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps'],
    });

    if (!media) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    // Reset failed/pending steps, leave success ones
    const stepsToReset = media.steps.filter(
      (s) => s.status === StepStatus.FAILED || s.status === StepStatus.PENDING,
    );
    for (const step of stepsToReset) {
      step.status = StepStatus.PENDING;
      step.error_message = null;
      step.retry_count += 1;
      await this.stepRepository.save(step);
    }

    media.status = MediaStatus.PENDING;
    media.error_message = null;
    return await this.mediaRepository.save(media);
  }

  private async transformMedia(media: Media): Promise<any> {
    const result: any = { ...media };

    // Dynamic URL generation for blob_storage_id
    if (media.blob_storage_id) {
      result.final_url = await this.storageService.getSignedUrl(media.blob_storage_id);
    }

    // Map assets by type
    result.assets_by_type = {};
    if (media.assets) {
      for (const asset of media.assets) {
        if (!result.assets_by_type[asset.type]) result.assets_by_type[asset.type] = [];
        const signedUrl = await this.storageService.getSignedUrl(asset.blob_storage_id);
        result.assets_by_type[asset.type].push({
          ...asset,
          url: signedUrl,
        });
      }
    }

    return result;
  }

  async addAsset(
    mediaId: string,
    type: MediaAssetType,
    blobId: string,
    metadata?: any,
  ): Promise<MediaAsset> {
    const asset = this.assetRepository.create({
      media_id: mediaId,
      type,
      blob_storage_id: blobId,
      metadata,
    });
    return await this.assetRepository.save(asset);
  }

  async updateMedia(id: string, dto: any): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    // Only update input_config for now
    if (dto) {
      media.input_config = {
        ...(media.input_config || {}),
        ...dto,
      };
    }

    return await this.mediaRepository.save(media);
  }
}
