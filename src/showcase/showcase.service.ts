import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../media/entities/media.entity';
import { Project } from '../projects/entities/project.entity';
import { Showcase } from './entities/showcase.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';

const SHOWCASE_SIGNED_URL_EXPIRES = 3600; // 1 hour
const DEFAULT_TEXT_TO_IMAGE_URL = 'https://placehold.co/400x600/1a1a2e/6366f1?text=Text+to+Image';

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
    const reelClipBlobId = config?.reel_clip_blob_id?.trim() || null;
    const graphicMotionClipBlobId = config?.graphic_motion_clip_blob_id?.trim() || null;
    const imageUrl = config?.text_to_image_url?.trim() || DEFAULT_TEXT_TO_IMAGE_URL;

    // Only show stored clips (1–2s). Never use full video in showcase.
    let reelUrl: string | null = null;
    if (reelClipBlobId) {
      try {
        reelUrl = await this.storageService.getSignedUrl(
          reelClipBlobId,
          SHOWCASE_SIGNED_URL_EXPIRES,
        );
      } catch {
        reelUrl = null;
      }
    }

    let graphicMotionUrl: string | null = null;
    if (graphicMotionClipBlobId) {
      try {
        graphicMotionUrl = await this.storageService.getSignedUrl(
          graphicMotionClipBlobId,
          SHOWCASE_SIGNED_URL_EXPIRES,
        );
      } catch {
        graphicMotionUrl = null;
      }
    }

    return {
      reel: { mediaId: mediaId ?? '', url: reelUrl },
      graphicMotion: { projectId: projectId ?? '', url: graphicMotionUrl },
      textToImage: { url: imageUrl },
    };
  }

  /**
   * Upload a 1–2s clip to S3 (showcase path) and set it on the showcase row.
   * Path: users/system/media/showcase/clip/reel.mp4 or graphic-motion.mp4
   */
  async uploadClip(type: 'reel' | 'graphic_motion', buffer: Buffer): Promise<{ blobId: string }> {
    const fileName = type === 'reel' ? 'reel.mp4' : 'graphic-motion.mp4';
    const blobId = await this.storageService.upload({
      userId: 'system',
      mediaId: 'showcase',
      type: 'clip',
      buffer,
      fileName,
    });

    const config = await this.showcaseRepository.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (config) {
      if (type === 'reel') {
        config.reel_clip_blob_id = blobId;
      } else {
        config.graphic_motion_clip_blob_id = blobId;
      }
      await this.showcaseRepository.save(config);
    }

    return { blobId };
  }

  /** Update showcase row (e.g. set clip blob IDs after external upload). */
  async update(config: {
    reel_clip_blob_id?: string | null;
    graphic_motion_clip_blob_id?: string | null;
    text_to_image_url?: string | null;
    reel_media_id?: string | null;
    graphic_motion_project_id?: string | null;
  }): Promise<Showcase> {
    const row = await this.showcaseRepository.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!row) throw new NotFoundException('No showcase row found');
    if (config.reel_clip_blob_id !== undefined)
      row.reel_clip_blob_id = config.reel_clip_blob_id || null;
    if (config.graphic_motion_clip_blob_id !== undefined)
      row.graphic_motion_clip_blob_id = config.graphic_motion_clip_blob_id || null;
    if (config.text_to_image_url !== undefined)
      row.text_to_image_url = config.text_to_image_url || null;
    if (config.reel_media_id !== undefined) row.reel_media_id = config.reel_media_id || null;
    if (config.graphic_motion_project_id !== undefined)
      row.graphic_motion_project_id = config.graphic_motion_project_id || null;
    return this.showcaseRepository.save(row);
  }
}
