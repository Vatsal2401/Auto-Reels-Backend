import { Injectable, Logger, Inject } from '@nestjs/common';
import { IStockVideoProvider, StockVideoClip, StockVideoSceneInput } from '../interfaces/stock-video-provider.interface';
import { IStorageService } from '../../storage/interfaces/storage.interface';
import { IImageGenerator } from '../interfaces/image-generator.interface';

const PEXELS_API_BASE = 'https://api.pexels.com/videos/search';

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
  total_results: number;
}

@Injectable()
export class PexelsStockVideoProvider implements IStockVideoProvider {
  private readonly logger = new Logger(PexelsStockVideoProvider.name);

  constructor(
    @Inject('IStorageService') private readonly storageService: IStorageService,
    @Inject('IImageGenerator') private readonly imageGenerator: IImageGenerator,
  ) {}

  async fetchClipsForScenes(
    scenes: StockVideoSceneInput[],
    mediaId?: string,
    userId?: string,
  ): Promise<StockVideoClip[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      throw new Error('PEXELS_API_KEY environment variable is not set');
    }

    const results: StockVideoClip[] = [];

    // Process sequentially to respect free-tier rate limit (200 req/hr)
    for (const scene of scenes) {
      try {
        const clip = await this.fetchClipForScene(scene, apiKey, mediaId, userId);
        results.push(clip);
      } catch (error) {
        this.logger.error(
          `Failed to fetch clip for scene ${scene.sceneIndex} (query: "${scene.query}"): ${error.message}`,
        );
        // Fall back to AI image for this scene
        try {
          const fallbackClip = await this.generateFallbackImage(scene, mediaId, userId);
          results.push(fallbackClip);
        } catch (fallbackError) {
          this.logger.error(
            `Fallback image also failed for scene ${scene.sceneIndex}: ${fallbackError.message}`,
          );
          // Skip this scene rather than fail the whole step
        }
      }
    }

    return results;
  }

  private async fetchClipForScene(
    scene: StockVideoSceneInput,
    apiKey: string,
    mediaId?: string,
    userId?: string,
  ): Promise<StockVideoClip> {
    const url = new URL(PEXELS_API_BASE);
    url.searchParams.set('query', scene.query);
    url.searchParams.set('orientation', 'portrait');
    url.searchParams.set('per_page', '3');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API returned ${response.status}: ${await response.text()}`);
    }

    const data: PexelsSearchResponse = await response.json();

    if (!data.videos || data.videos.length === 0) {
      this.logger.warn(
        `No Pexels results for scene ${scene.sceneIndex} (query: "${scene.query}"), using fallback`,
      );
      return this.generateFallbackImage(scene, mediaId, userId);
    }

    const video = data.videos[0]!;
    const videoFile = this.pickBestVideoFile(video.video_files);

    if (!videoFile) {
      this.logger.warn(
        `No suitable video file for scene ${scene.sceneIndex}, using fallback`,
      );
      return this.generateFallbackImage(scene, mediaId, userId);
    }

    this.logger.log(
      `Downloading Pexels clip for scene ${scene.sceneIndex} (${videoFile.width}x${videoFile.height})...`,
    );

    const videoResponse = await fetch(videoFile.link);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video clip: ${videoResponse.status}`);
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer());

    const blobId = await this.storageService.upload({
      userId: userId || 'unknown',
      mediaId: mediaId || 'unknown',
      type: 'stock_video',
      step: 'stockVideos',
      buffer,
      fileName: `scene_${scene.sceneIndex}.mp4`,
    });

    return { blobId, sceneIndex: scene.sceneIndex, isFallback: false };
  }

  private pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
    if (!files || files.length === 0) return null;

    // Filter to MP4 only
    const mp4Files = files.filter((f) => f.file_type === 'video/mp4' || f.link.endsWith('.mp4'));
    const pool = mp4Files.length > 0 ? mp4Files : files;

    // Prefer width=1080 (portrait HD)
    const preferred = pool.find((f) => f.width === 1080);
    if (preferred) return preferred;

    // Otherwise pick highest width
    return pool.reduce((best, f) => (f.width > best.width ? f : best), pool[0]!);
  }

  private async generateFallbackImage(
    scene: StockVideoSceneInput,
    mediaId?: string,
    userId?: string,
  ): Promise<StockVideoClip> {
    this.logger.log(
      `Generating fallback AI image for scene ${scene.sceneIndex} (query: "${scene.query}")`,
    );

    const buffer = await this.imageGenerator.generateImage({
      prompt: scene.query,
      aspectRatio: '9:16',
    });

    const blobId = await this.storageService.upload({
      userId: userId || 'unknown',
      mediaId: mediaId || 'unknown',
      type: 'image',
      step: 'stockVideos',
      buffer,
      fileName: `scene_${scene.sceneIndex}_fallback.jpg`,
    });

    return { blobId, sceneIndex: scene.sceneIndex, isFallback: true };
  }
}
