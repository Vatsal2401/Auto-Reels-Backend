import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../media/entities/media.entity';
import { Project } from '../projects/entities/project.entity';
import { Showcase } from './entities/showcase.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';

const SHOWCASE_SIGNED_URL_EXPIRES = 3600; // 1 hour
const DEFAULT_TEXT_TO_IMAGE_URL =
  'https://placehold.co/400x600/1a1a2e/6366f1?text=Text+to+Image';

export interface ShowcaseResponse {
  reel: { mediaId: string; url: string | null };
  graphicMotion: { projectId: string; url: string | null };
  textToImage: { url: string };
}

@Injectable()
export class ShowcaseService {
  constructor(
    @InjectRepository(Showcase)
    private readonly showcaseRepository: Repository<Showcase>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Inject('IStorageService')
    private readonly storageService: IStorageService,
  ) {}

  async getShowcase(): Promise<ShowcaseResponse> {
    const config = await this.showcaseRepository.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });

    const mediaId = config?.reel_media_id ?? null;
    const projectId = config?.graphic_motion_project_id ?? null;
    const imageUrl =
      config?.text_to_image_url?.trim() || DEFAULT_TEXT_TO_IMAGE_URL;

    let reelUrl: string | null = null;
    if (mediaId) {
      const media = await this.mediaRepository.findOne({ where: { id: mediaId } });
      if (media?.blob_storage_id) {
        try {
          reelUrl = await this.storageService.getSignedUrl(
            media.blob_storage_id,
            SHOWCASE_SIGNED_URL_EXPIRES,
          );
        } catch {
          reelUrl = null;
        }
      }
    }

    let graphicMotionUrl: string | null = null;
    if (projectId) {
      const project = await this.projectRepository.findOne({
        where: { id: projectId },
      });
      if (project?.output_url) {
        try {
          graphicMotionUrl = await this.storageService.getSignedUrl(
            project.output_url,
            SHOWCASE_SIGNED_URL_EXPIRES,
          );
        } catch {
          graphicMotionUrl = null;
        }
      }
    }

    return {
      reel: { mediaId: mediaId ?? '', url: reelUrl },
      graphicMotion: { projectId: projectId ?? '', url: graphicMotionUrl },
      textToImage: { url: imageUrl },
    };
  }
}
