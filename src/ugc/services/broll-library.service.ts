import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UgcContentLibrary, UgcClipType } from '../entities/ugc-content-library.entity';

export interface BrollMatch {
  id: string;
  s3Key: string;
  title: string;
  durationSeconds: number | null;
  source: 'library' | 'pexels';
  pexelsUrl?: string; // Only for Pexels fallback
}

@Injectable()
export class BrollLibraryService {
  private readonly logger = new Logger(BrollLibraryService.name);

  constructor(
    @InjectRepository(UgcContentLibrary)
    private readonly contentRepo: Repository<UgcContentLibrary>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Find the best matching b-roll clip for a given scene query.
   * Falls back to Pexels API if library has no match.
   */
  async findClip(params: {
    query: string;
    clipType: UgcClipType;
    categoryTags?: string[];
  }): Promise<BrollMatch | null> {
    const { query, clipType, categoryTags } = params;

    // 1. Try GIN tag search in local library
    const tags = this.extractTags(query, categoryTags);
    if (tags.length > 0) {
      const clip = await this.contentRepo
        .createQueryBuilder('c')
        .where('c.is_active = true')
        .andWhere('c.clip_type = :clipType', { clipType })
        .andWhere('c.category_tags && :tags', { tags })
        .orderBy('c.usage_count', 'ASC')
        .getOne();

      if (clip) {
        await this.contentRepo.increment({ id: clip.id }, 'usage_count', 1);
        return {
          id: clip.id,
          s3Key: clip.s3_key,
          title: clip.title,
          durationSeconds: clip.duration_seconds,
          source: 'library',
        };
      }
    }

    // 2. Fallback: any clip of matching type
    const fallback = await this.contentRepo.findOne({
      where: { clip_type: clipType, is_active: true },
      order: { usage_count: 'ASC' },
    });

    if (fallback) {
      await this.contentRepo.increment({ id: fallback.id }, 'usage_count', 1);
      return {
        id: fallback.id,
        s3Key: fallback.s3_key,
        title: fallback.title,
        durationSeconds: fallback.duration_seconds,
        source: 'library',
      };
    }

    // 3. Pexels API fallback
    return this.fetchFromPexels(query);
  }

  private extractTags(query: string, extraTags?: string[]): string[] {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    return [...new Set([...words, ...(extraTags || [])])].slice(0, 5);
  }

  private async fetchFromPexels(query: string): Promise<BrollMatch | null> {
    const apiKey = this.configService.get<string>('PEXELS_API_KEY');
    if (!apiKey) {
      this.logger.warn('PEXELS_API_KEY not configured — no b-roll fallback available');
      return null;
    }

    try {
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`,
        { headers: { Authorization: apiKey } },
      );

      if (!res.ok) {
        this.logger.warn(`Pexels API returned ${res.status} for query: ${query}`);
        return null;
      }

      const data = (await res.json()) as {
        videos: {
          id: number;
          duration: number;
          video_files: { link: string; quality: string; width: number }[];
        }[];
      };

      const video = data.videos?.[0];
      if (!video) return null;

      const file =
        video.video_files.find((f) => f.quality === 'hd' && f.width <= 1080) ||
        video.video_files[0];

      this.logger.log(`Pexels fallback: found video for query="${query}"`);
      return {
        id: `pexels-${video.id}`,
        s3Key: '',
        title: query,
        durationSeconds: video.duration,
        source: 'pexels',
        pexelsUrl: file?.link,
      };
    } catch (err) {
      this.logger.error(`Pexels fetch failed: ${err.message}`);
      return null;
    }
  }
}
