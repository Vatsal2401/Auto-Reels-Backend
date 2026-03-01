import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
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
import { StorageResolverService } from '../storage/storage-resolver.service';
import { User } from '../auth/entities/user.entity';
import { BackgroundMusic } from './entities/background-music.entity';
import { ElevenLabsService } from '../ai/elevenlabs.service';
import { IVoiceManagementService } from '../ai/interfaces/voice-management.interface';
import { ProjectsService } from '../projects/projects.service';

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
    @InjectRepository(BackgroundMusic)
    private musicRepository: Repository<BackgroundMusic>,
    private creditsService: CreditsService,
    @Inject('IStorageService') private storageService: IStorageService,
    @Optional() private storageResolver: StorageResolverService | null,
    @Optional() private elevenLabsService: ElevenLabsService | null,
    @Inject('IVoiceManagementService') private voiceManagementService: IVoiceManagementService,
    private projectsService: ProjectsService,
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

    const defaultBackend = (process.env.DEFAULT_STORAGE_BACKEND || 's3') as 'supabase' | 's3';
    // Resolve voiceId from voice type + language when both provided (e.g. "Grounded And Professional" + "Hindi")
    if (dto.voiceLabel && dto.language) {
      dto.voiceId = this.voiceManagementService.getVoiceId(dto.voiceLabel, dto.language);
    }

    // Create a Project for this reel (tool_type=reel) so it appears in Projects list
    const project = await this.projectsService.create(
      'reel',
      {
        topic: dto.topic,
        duration: dto.duration,
        flowKey,
        credit_cost: creditCost,
      },
      userId || null,
    );

    const media = this.mediaRepository.create({
      type: dto.type || MediaType.VIDEO,
      flow_key: flowKey,
      status: MediaStatus.PENDING,
      user_id: userId || null,
      project_id: project.id,
      input_config: dto,
      blob_storage_backend: defaultBackend,
    });

    const savedMedia = await this.mediaRepository.save(media);

    await this.projectsService.setMetadata(project.id, { media_id: savedMedia.id });

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

  async getMedia(id: string, options?: { expiresIn?: number }): Promise<any> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps', 'assets'],
    });

    if (!media) {
      throw new NotFoundException(`Media with ID ${id} not found`);
    }

    const expiresIn = options?.expiresIn ?? 3600;
    return await this.transformMedia(media, expiresIn);
  }

  async getUserMedia(userId: string): Promise<any[]> {
    const mediaList = await this.mediaRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['steps'],
    });

    return await Promise.all(mediaList.map((m) => this.transformMedia(m, 3600)));
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

  private async getSignedUrlForMedia(
    objectId: string,
    backend: 'supabase' | 's3' | null,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (this.storageResolver) {
      const b = backend ?? 'supabase';
      return this.storageResolver.getSignedUrl(b, objectId, expiresIn);
    }
    return this.storageService.getSignedUrl(objectId, expiresIn);
  }

  private async transformMedia(media: Media, expiresIn: number = 3600): Promise<any> {
    const result: any = { ...media };
    const backend = media.blob_storage_backend ?? 'supabase';

    if (media.blob_storage_id) {
      result.final_url = await this.getSignedUrlForMedia(media.blob_storage_id, backend, expiresIn);
    }

    result.assets_by_type = {};
    if (media.assets) {
      for (const asset of media.assets) {
        if (!result.assets_by_type[asset.type]) result.assets_by_type[asset.type] = [];
        const signedUrl = await this.getSignedUrlForMedia(
          asset.blob_storage_id,
          backend,
          expiresIn,
        );
        result.assets_by_type[asset.type].push({
          ...asset,
          url: signedUrl,
        });
      }
    }

    // Fresh signed URL for background music so it does not expire during long renders
    const musicConfig = media.input_config?.music;
    if (musicConfig?.id) {
      const musicEntity = await this.musicRepository.findOne({ where: { id: musicConfig.id } });
      if (musicEntity?.blob_storage_id) {
        const musicUrl = await this.getSignedUrlForMedia(
          musicEntity.blob_storage_id,
          backend,
          expiresIn,
        );
        result.input_config = {
          ...(result.input_config || {}),
          music: { ...musicConfig, url: musicUrl },
        };
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
