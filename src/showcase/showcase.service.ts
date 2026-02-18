import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../media/entities/media.entity';
import { Project } from '../projects/entities/project.entity';
import { ShowcaseItem, ShowcaseItemType } from './entities/showcase-item.entity';
import { IStorageService } from '../storage/interfaces/storage.interface';

const SHOWCASE_SIGNED_URL_EXPIRES = 3600; // 1 hour
const DEFAULT_TEXT_TO_IMAGE_URL = 'https://placehold.co/400x600/1a1a2e/6366f1?text=Text+to+Image';

export interface ShowcaseItemResponse {
  id: string;
  type: ShowcaseItemType;
  url: string | null;
  mediaId?: string;
  projectId?: string;
}

export interface ShowcaseResponse {
  items: ShowcaseItemResponse[];
}

@Injectable()
export class ShowcaseService {
  constructor(
    @InjectRepository(ShowcaseItem)
    private readonly showcaseItemRepository: Repository<ShowcaseItem>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Inject('IStorageService')
    private readonly storageService: IStorageService,
  ) {}

  /** Showcase always uses clip URL only (no fallback to full media video). */
  private async resolveReelUrl(clipBlobId: string | null): Promise<string | null> {
    if (!clipBlobId?.trim()) return null;
    try {
      return await this.storageService.getSignedUrl(clipBlobId.trim(), SHOWCASE_SIGNED_URL_EXPIRES);
    } catch {
      return null;
    }
  }

  /** Showcase always uses clip URL only (no fallback to full project video). */
  private async resolveGraphicMotionUrl(clipBlobId: string | null): Promise<string | null> {
    if (!clipBlobId?.trim()) return null;
    try {
      return await this.storageService.getSignedUrl(clipBlobId.trim(), SHOWCASE_SIGNED_URL_EXPIRES);
    } catch {
      return null;
    }
  }

  async getShowcase(): Promise<ShowcaseResponse> {
    const rows = await this.showcaseItemRepository.find({
      order: { sort_order: 'ASC' },
    });

    const items: ShowcaseItemResponse[] = await Promise.all(
      rows.map(async (row) => {
        let url: string | null = null;
        if (row.type === 'reel') {
          url = await this.resolveReelUrl(row.clip_blob_id ?? null);
          return {
            id: row.id,
            type: row.type,
            url,
            mediaId: row.media_id ?? undefined,
          };
        }
        if (row.type === 'graphic_motion') {
          url = await this.resolveGraphicMotionUrl(row.clip_blob_id ?? null);
          return {
            id: row.id,
            type: row.type,
            url,
            projectId: row.project_id ?? undefined,
          };
        }
        url = row.image_url?.trim() || DEFAULT_TEXT_TO_IMAGE_URL;
        return {
          id: row.id,
          type: row.type,
          url,
        };
      }),
    );

    return { items };
  }

  async createItem(dto: {
    type: ShowcaseItemType;
    mediaId?: string | null;
    projectId?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
  }): Promise<ShowcaseItem> {
    const maxOrder = await this.showcaseItemRepository
      .createQueryBuilder('s')
      .select('COALESCE(MAX(s.sort_order), -1)', 'max')
      .getRawOne<{ max: number }>();
    const sort_order = dto.sortOrder ?? (maxOrder?.max ?? -1) + 1;

    const item = this.showcaseItemRepository.create({
      type: dto.type,
      sort_order,
      media_id: dto.type === 'reel' ? dto.mediaId || null : null,
      project_id: dto.type === 'graphic_motion' ? dto.projectId || null : null,
      image_url: dto.type === 'text_to_image' ? dto.imageUrl || null : null,
    });
    return this.showcaseItemRepository.save(item);
  }

  async updateItem(
    id: string,
    dto: {
      type?: ShowcaseItemType;
      mediaId?: string | null;
      projectId?: string | null;
      imageUrl?: string | null;
      clipBlobId?: string | null;
      sortOrder?: number;
    },
  ): Promise<ShowcaseItem> {
    const item = await this.showcaseItemRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Showcase item not found');
    if (dto.type !== undefined) item.type = dto.type;
    if (dto.sortOrder !== undefined) item.sort_order = dto.sortOrder;
    if (dto.mediaId !== undefined) item.media_id = dto.mediaId || null;
    if (dto.projectId !== undefined) item.project_id = dto.projectId || null;
    if (dto.imageUrl !== undefined) item.image_url = dto.imageUrl || null;
    if (dto.clipBlobId !== undefined) item.clip_blob_id = dto.clipBlobId || null;
    return this.showcaseItemRepository.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const result = await this.showcaseItemRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Showcase item not found');
  }

  async uploadClipForItem(itemId: string, buffer: Buffer): Promise<{ blobId: string }> {
    const item = await this.showcaseItemRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Showcase item not found');
    if (item.type !== 'reel' && item.type !== 'graphic_motion') {
      throw new NotFoundException('Item must be reel or graphic_motion to upload a clip');
    }
    const fileName = `${itemId}.mp4`;
    const blobId = await this.storageService.upload({
      userId: 'system',
      mediaId: 'showcase',
      type: 'clip',
      buffer,
      fileName,
    });
    item.clip_blob_id = blobId;
    await this.showcaseItemRepository.save(item);
    return { blobId };
  }
}
