import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
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
  RERENDER_STEPS_FROM_SCRIPT,
  RERENDER_STEPS_FROM_RENDER,
} from './media.constants';
import { CreditsService } from '../credits/credits.service';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { User } from '../auth/entities/user.entity';

/** Operation names for guard error messages */
const GUARD_OPERATIONS = {
  update: 'edit',
  rerender: 'rerender',
} as const;

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

  /**
   * Delete media and its steps/assets. Verifies ownership. Does not delete blobs from storage.
   */
  async deleteMedia(id: string, userId: string): Promise<void> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }
    if (media.user_id !== userId) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    const stepIds = (await this.stepRepository.find({ where: { media_id: id } })).map((s) => s.id);
    const assets = await this.assetRepository.find({ where: { media_id: id } });
    const assetIds = assets.map((a) => a.id);

    for (const stepId of stepIds) {
      await this.stepRepository.delete(stepId);
    }
    for (const assetId of assetIds) {
      await this.assetRepository.delete(assetId);
    }
    await this.mediaRepository.delete(id);
  }

  /**
   * Duplicate media as a new draft (same input_config, script; new steps; no assets). No auto-process.
   */
  async duplicateMedia(id: string, userId: string): Promise<Media> {
    const source = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps'],
    });
    if (!source) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }
    if (source.user_id !== userId) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    const flow = MEDIA_FLOWS[source.flow_key];
    if (!flow) {
      throw new BadRequestException(`Invalid flow_key: ${source.flow_key}`);
    }

    const media = this.mediaRepository.create({
      type: source.type,
      flow_key: source.flow_key,
      status: MediaStatus.PENDING,
      user_id: userId,
      input_config: source.input_config ? { ...source.input_config } : null,
      script: source.script,
    });
    const saved = await this.mediaRepository.save(media);

    const steps = flow.steps.map((stepName) =>
      this.stepRepository.create({
        media_id: saved.id,
        step: stepName,
        status: StepStatus.PENDING,
        depends_on: flow.dependencies[stepName] || [],
        retry_count: 0,
      }),
    );
    await this.stepRepository.save(steps);

    return saved;
  }

  /**
   * Create a new version of the media (new row with parent_media_id, incremented version) and run pipeline.
   * Does not overwrite the current media; returns the new media id.
   */
  async exportAsVersion(id: string, userId: string): Promise<Media> {
    const source = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps'],
    });
    if (!source) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }
    if (source.user_id !== userId) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    this.guardProcessingState(source, 'rerender');

    const flow = MEDIA_FLOWS[source.flow_key];
    if (!flow) {
      throw new BadRequestException(`Invalid flow_key: ${source.flow_key}`);
    }

    const rootId = source.parent_media_id ?? source.id;
    const maxVersion = await this.mediaRepository
      .createQueryBuilder('m')
      .select('MAX(m.version)', 'max')
      .where('m.parent_media_id = :rootId', { rootId })
      .getRawOne<{ max: number | null }>();
    const nextVersion = (maxVersion?.max ?? 0) + 1;

    const media = this.mediaRepository.create({
      type: source.type,
      flow_key: source.flow_key,
      status: MediaStatus.PENDING,
      user_id: userId,
      input_config: source.input_config ? { ...source.input_config } : null,
      script: source.script,
      parent_media_id: rootId,
      version: nextVersion,
    });
    const saved = await this.mediaRepository.save(media);

    const steps = flow.steps.map((stepName) =>
      this.stepRepository.create({
        media_id: saved.id,
        step: stepName,
        status: StepStatus.PENDING,
        depends_on: flow.dependencies[stepName] || [],
        retry_count: 0,
      }),
    );
    await this.stepRepository.save(steps);

    return saved;
  }

  /**
   * Normalized payload for the editor (stable contract). Requires media with assets.
   */
  async getEditorPayload(id: string): Promise<{
    id: string;
    title: string;
    duration: string;
    script: string | null;
    audioUrl: string | null;
    captionUrl: string | null;
    imageUrls: string[];
    inputConfig: Record<string, any> | null;
    status: string;
    final_url?: string;
  }> {
    const raw = await this.getMedia(id);
    const config = raw.input_config || {};
    const byType = raw.assets_by_type || {};
    const first = (arr: any[]) => (Array.isArray(arr) && arr.length ? arr[0] : null);
    const urls = (arr: any[]) => (Array.isArray(arr) ? arr.map((a) => a.url).filter(Boolean) : []);

    return {
      id: raw.id,
      title: config.topic || 'Untitled',
      duration: config.duration || '30-60',
      script: raw.script ?? null,
      audioUrl: first(byType.audio)?.url ?? null,
      captionUrl: first(byType.caption)?.url ?? null,
      imageUrls: urls(byType.image || []),
      inputConfig: config,
      status: raw.status,
      final_url: raw.final_url,
    };
  }

  async getUserMedia(userId: string): Promise<any[]> {
    const mediaList = await this.mediaRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['steps', 'assets'],
    });

    return await Promise.all(mediaList.map((m) => this.transformMedia(m)));
  }

  /**
   * Paginated list for infinite scroll. Returns items + nextCursor (opaque, pass back for next page).
   */
  async getUserMediaPaginated(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: any[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(1, limit), 50);
    const qb = this.mediaRepository
      .createQueryBuilder('m')
      .where('m.user_id = :userId', { userId })
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take + 1)
      .leftJoinAndSelect('m.steps', 'steps')
      .leftJoinAndSelect('m.assets', 'assets');

    if (cursor) {
      try {
        const [createdAt, id] = Buffer.from(cursor, 'base64').toString('utf8').split(',');
        if (createdAt && id) {
          qb.andWhere(
            '(m.created_at < :cursorAt OR (m.created_at = :cursorAt AND m.id < :cursorId))',
            { cursorAt: new Date(createdAt), cursorId: id },
          );
        }
      } catch {
        // invalid cursor, ignore
      }
    }

    const mediaList = await qb.getMany();
    const hasMore = mediaList.length > take;
    const page = hasMore ? mediaList.slice(0, take) : mediaList;
    const items = await Promise.all(page.map((m) => this.transformMedia(m)));
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.created_at.toISOString()},${last.id}`, 'utf8').toString('base64')
        : null;

    return { items, nextCursor };
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

  /**
   * Prevents operations while media is processing. Use for update and rerender to avoid race conditions.
   */
  private guardProcessingState(media: Media, operation: keyof typeof GUARD_OPERATIONS): void {
    if (media.status === MediaStatus.PROCESSING) {
      throw new ConflictException(
        `Cannot ${GUARD_OPERATIONS[operation]} while reel is rendering. Wait for completion or failure.`,
      );
    }
  }

  /**
   * Explicitly reset given steps to PENDING and clear execution state. Deterministic step reset.
   */
  async resetSteps(mediaId: string, stepNames: readonly string[]): Promise<void> {
    const steps = await this.stepRepository.find({
      where: { media_id: mediaId },
    });
    for (const step of steps) {
      if (stepNames.includes(step.step)) {
        await this.stepRepository.update(step.id, {
          status: StepStatus.PENDING,
          blob_storage_id: null,
          error_message: null,
          started_at: null,
          completed_at: null,
        });
      }
    }
  }

  /**
   * Mark assets of given types as obsolete (metadata.obsolete = true). No blob deletion.
   * Prepares for future revision/versioning; pipeline uses latest non-obsolete assets.
   */
  async markAssetsObsolete(mediaId: string, types: MediaAssetType[]): Promise<void> {
    const assets = await this.assetRepository.find({
      where: { media_id: mediaId },
    });
    for (const asset of assets) {
      if (types.includes(asset.type)) {
        await this.assetRepository.update(asset.id, {
          metadata: { ...(asset.metadata || {}), obsolete: true } as any,
        });
      }
    }
  }

  /**
   * Rerender: reset steps and optionally mark assets obsolete, clear output, set PENDING.
   * Does NOT trigger orchestration (controller calls processMedia after).
   * Kept separate from retry logic.
   */
  async rerenderMedia(
    id: string,
    userId: string,
    fromStep: 'render' | 'script' = 'render',
  ): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['steps'],
    });
    if (!media) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }
    if (media.user_id !== userId) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    this.guardProcessingState(media, 'rerender');

    if (fromStep === 'render') {
      await this.resetSteps(id, RERENDER_STEPS_FROM_RENDER);
    } else {
      await this.markAssetsObsolete(id, [
        MediaAssetType.SCRIPT,
        MediaAssetType.AUDIO,
        MediaAssetType.CAPTION,
        MediaAssetType.IMAGE,
      ]);
      await this.resetSteps(id, RERENDER_STEPS_FROM_SCRIPT);
    }

    media.blob_storage_id = null;
    media.error_message = null;
    media.completed_at = null;
    media.status = MediaStatus.PENDING;
    return await this.mediaRepository.save(media);
  }

  private async transformMedia(media: Media): Promise<any> {
    const result: any = { ...media };

    // Dynamic URL generation for blob_storage_id
    if (media.blob_storage_id) {
      result.final_url = await this.storageService.getSignedUrl(media.blob_storage_id);
    }

    // Map assets by type; exclude obsolete (e.g. from previous rerender) for clean API contract
    result.assets_by_type = {};
    if (media.assets) {
      const activeAssets = media.assets.filter(
        (a) => !(a.metadata && (a.metadata as any).obsolete === true),
      );
      for (const asset of activeAssets) {
        if (!result.assets_by_type[asset.type]) result.assets_by_type[asset.type] = [];
        const signedUrl = await this.storageService.getSignedUrl(asset.blob_storage_id);
        result.assets_by_type[asset.type].push({
          ...asset,
          url: signedUrl,
        });
      }
      // Thumbnail = first image asset by created_at (row one)
      const images = (result.assets_by_type[MediaAssetType.IMAGE] as any[]) || [];
      const firstImage = images.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];
      result.thumbnail_url = firstImage?.url ?? null;
    } else {
      result.thumbnail_url = null;
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

  /**
   * Update media metadata (input_config, script). Execution state (steps/assets) is separate.
   * Prevents edit during processing to avoid race conditions.
   * TODO: When media_revision table exists, create new revision on update instead of mutating in place.
   */
  async updateMedia(id: string, dto: any): Promise<Media> {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media ID ${id} not found`);
    }

    this.guardProcessingState(media, 'update');

    if (dto && typeof dto === 'object') {
      if (dto.script !== undefined) {
        media.script = dto.script;
      }
      const rest: Record<string, any> = { ...(media.input_config || {}) };
      for (const [k, v] of Object.entries(dto)) {
        if (v !== undefined && k !== 'script') rest[k] = v;
      }
      if (dto.script !== undefined) rest.script = dto.script;
      if (dto.script_json !== undefined) rest.script_json = dto.script_json;
      media.input_config = rest;
    }

    return await this.mediaRepository.save(media);
  }
}
