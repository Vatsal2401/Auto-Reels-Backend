import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UgcActor } from '../entities/ugc-actor.entity';
import { UgcContentLibrary } from '../entities/ugc-content-library.entity';
import { UgcAbTest } from '../entities/ugc-ab-test.entity';
import { CreateUgcVideoDto } from '../dto/create-ugc-video.dto';
import { Media } from '../../media/entities/media.entity';
import { MediaStep, StepStatus } from '../../media/entities/media-step.entity';
import { MEDIA_FLOWS, MediaStatus, MediaType } from '../../media/media.constants';
import { CreditsService } from '../../credits/credits.service';
import { IStorageService } from '../../storage/interfaces/storage.interface';

const UGC_CREDIT_COST = 3;

@Injectable()
export class UgcService {
  private readonly logger = new Logger(UgcService.name);

  constructor(
    @InjectRepository(UgcActor)
    private readonly actorRepo: Repository<UgcActor>,
    @InjectRepository(UgcContentLibrary)
    private readonly contentRepo: Repository<UgcContentLibrary>,
    @InjectRepository(UgcAbTest)
    private readonly abTestRepo: Repository<UgcAbTest>,
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    @InjectRepository(MediaStep)
    private readonly stepRepo: Repository<MediaStep>,
    private readonly creditsService: CreditsService,
    @Inject('IStorageService') private readonly storageService: IStorageService,
  ) {}

  async listActors(filters?: {
    gender?: string;
    ageGroup?: string;
    region?: string;
    style?: string;
  }): Promise<UgcActor[]> {
    const qb = this.actorRepo.createQueryBuilder('a').where('a.is_active = true');
    if (filters?.gender) qb.andWhere('a.gender = :gender', { gender: filters.gender });
    if (filters?.ageGroup) qb.andWhere('a.age_group = :ageGroup', { ageGroup: filters.ageGroup });
    if (filters?.region) qb.andWhere('a.region = :region', { region: filters.region });
    if (filters?.style) qb.andWhere('a.style = :style', { style: filters.style });
    const actors = await qb.orderBy('a.usage_count', 'ASC').getMany();

    // Generate signed preview URLs
    return Promise.all(
      actors.map(async (actor) => {
        const a = { ...actor } as any;
        if (actor.portrait_s3_key) {
          a.portrait_url = await this.storageService.getSignedUrl(actor.portrait_s3_key, 3600);
        }
        if (actor.preview_s3_key) {
          a.preview_url = await this.storageService.getSignedUrl(actor.preview_s3_key, 3600);
        }
        return a;
      }),
    );
  }

  async createUgcVideo(dto: CreateUgcVideoDto, userId: string): Promise<Media> {
    // Credit check
    const hasCredits = await this.creditsService.hasEnoughCredits(userId, UGC_CREDIT_COST);
    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. UGC video generation requires ${UGC_CREDIT_COST} credits.`,
      );
    }

    // Validate actor exists
    const actor = await this.actorRepo.findOne({ where: { id: dto.actorId, is_active: true } });
    if (!actor) throw new NotFoundException(`Actor ${dto.actorId} not found`);

    const flow = MEDIA_FLOWS['ugcVideo'];
    if (!flow) throw new Error('ugcVideo flow not registered in MEDIA_FLOWS');

    // Create media record
    const media = this.mediaRepo.create({
      type: MediaType.VIDEO,
      flow_key: 'ugcVideo',
      status: MediaStatus.PENDING,
      user_id: userId,
      blob_storage_backend: (process.env.DEFAULT_STORAGE_BACKEND || 's3') as 'supabase' | 's3',
      input_config: {
        ...dto,
        ugcVideo: true,
        topic: `UGC Ad: ${dto.productName}`,
        creditCost: UGC_CREDIT_COST,
      },
    });

    const savedMedia = await this.mediaRepo.save(media);

    // Create steps
    const steps = flow.steps.map((stepName) =>
      this.stepRepo.create({
        media_id: savedMedia.id,
        step: stepName,
        status: StepStatus.PENDING,
        depends_on: flow.dependencies[stepName] || [],
        retry_count: 0,
      }),
    );
    await this.stepRepo.save(steps);

    // Increment actor usage count
    await this.actorRepo.increment({ id: actor.id }, 'usage_count', 1);

    return savedMedia;
  }

  async listAbTests(parentMediaId: string): Promise<UgcAbTest[]> {
    return this.abTestRepo.find({ where: { parent_media_id: parentMediaId } });
  }

  async createAbTest(params: {
    parentMediaId: string;
    variantMediaId: string;
    variantType: string;
    variantLabel?: string;
  }): Promise<UgcAbTest> {
    const test = this.abTestRepo.create({
      parent_media_id: params.parentMediaId,
      variant_media_id: params.variantMediaId,
      variant_type: params.variantType,
      variant_label: params.variantLabel ?? null,
    });
    return this.abTestRepo.save(test);
  }
}
