import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../../media/entities/media.entity';
import { MediaStep, StepStatus } from '../../media/entities/media-step.entity';
import { MEDIA_FLOWS, MediaStatus, MediaType } from '../../media/media.constants';
import { CreditsService } from '../../credits/credits.service';
import { CreateStoryDto } from '../dto/create-story.dto';

const STORY_CREDIT_COST = 2;

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
    @InjectRepository(MediaStep)
    private readonly stepRepo: Repository<MediaStep>,
    private readonly creditsService: CreditsService,
  ) {}

  async createStory(dto: CreateStoryDto, userId: string): Promise<Media> {
    const hasCredits = await this.creditsService.hasEnoughCredits(userId, STORY_CREDIT_COST);
    if (!hasCredits) {
      throw new BadRequestException(
        `Insufficient credits. Story Reel generation requires ${STORY_CREDIT_COST} credits.`,
      );
    }

    const flow = MEDIA_FLOWS['storyReel'];
    if (!flow) throw new Error('storyReel flow not registered in MEDIA_FLOWS');

    const media = this.mediaRepo.create({
      type: MediaType.VIDEO,
      flow_key: 'storyReel',
      status: MediaStatus.PENDING,
      user_id: userId,
      blob_storage_backend: (process.env.DEFAULT_STORAGE_BACKEND || 's3') as 'supabase' | 's3',
      input_config: {
        prompt: dto.prompt,
        topic: dto.prompt,
        genre: dto.genre,
        sceneCount: dto.sceneCount,
        voiceId: dto.voiceId,
        voiceLabel: dto.voiceLabel,
        musicId: dto.musicId,
        creditCost: STORY_CREDIT_COST,
        storyReel: true,
      },
    });

    const savedMedia = await this.mediaRepo.save(media);

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

    this.logger.log(
      `Created storyReel media ${savedMedia.id} for user ${userId} (genre: ${dto.genre}, scenes: ${dto.sceneCount})`,
    );

    return savedMedia;
  }
}
