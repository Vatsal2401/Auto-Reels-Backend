import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { CreditsService } from '../credits/credits.service';
import { IStorageService } from '../storage/interfaces/storage.interface';

@Injectable()
export class VideoService {
  private readonly CREDITS_PER_VIDEO = 1;

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    private creditsService: CreditsService,
    @Inject('IStorageService') private storageService: IStorageService,
  ) { }

  async createVideo(dto: CreateVideoDto, userId?: string): Promise<Video> {
    // Check if user has enough credits (only for authenticated users)
    if (userId) {
      const hasEnoughCredits = await this.creditsService.hasEnoughCredits(
        userId,
        this.CREDITS_PER_VIDEO,
      );

      if (!hasEnoughCredits) {
        throw new BadRequestException(
          'Insufficient credits. You need at least 1 credit to create a video.',
        );
      }
    }

    const video = this.videoRepository.create({
      topic: dto.topic,
      status: VideoStatus.PENDING,
      user_id: userId || null,
    });
    return await this.videoRepository.save(video);
  }

  async getVideo(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ['jobs', 'assets'],
    });
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return await this.transformVideoUrls(video);
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    const videos = await this.videoRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    return await Promise.all(videos.map(video => this.transformVideoUrls(video)));
  }

  async updateStatus(id: string, status: VideoStatus): Promise<void> {
    await this.videoRepository.update(id, { status });
  }

  async updateScript(id: string, script: string): Promise<void> {
    await this.videoRepository.update(id, {
      script,
      script_generated_at: new Date(),
      status: VideoStatus.SCRIPT_COMPLETE,
    });
  }

  async updateScriptJSON(id: string, scriptJSON: Record<string, any>): Promise<void> {
    await this.videoRepository.update(id, {
      script_json: scriptJSON,
    });
  }

  async updateImageUrls(id: string, imageUrls: string[]): Promise<void> {
    await this.videoRepository.update(id, { image_urls: imageUrls });
  }

  async updateGeneratedVideoUrl(id: string, generatedVideoUrl: string): Promise<void> {
    await this.videoRepository.update(id, { generated_video_url: generatedVideoUrl });
  }

  async updateAudioUrl(id: string, audioUrl: string): Promise<void> {
    await this.videoRepository.update(id, { audio_url: audioUrl });
  }

  async updateCaptionUrl(id: string, captionUrl: string): Promise<void> {
    await this.videoRepository.update(id, { caption_url: captionUrl });
  }

  async updateAssetUrls(id: string, assetUrls: string[]): Promise<void> {
    await this.videoRepository.update(id, { asset_urls: assetUrls });
  }

  async completeVideo(id: string, finalVideoUrl: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    // Update video status
    await this.videoRepository.update(id, {
      final_video_url: finalVideoUrl,
      status: VideoStatus.COMPLETED,
      completed_at: new Date(),
    });

    // Deduct credit only for authenticated users and only on successful completion
    if (video.user_id) {
      try {
        await this.creditsService.deductCredits(
          video.user_id,
          this.CREDITS_PER_VIDEO,
          `Video generation: ${video.topic}`,
          video.id,
          { video_id: video.id, video_topic: video.topic },
        );
      } catch (error) {
        // Log error but don't fail video completion
        // This handles edge cases where credits might have been deducted already
        console.error(`Failed to deduct credits for video ${id}:`, error);
      }
    }
  }

  async failVideo(id: string, errorMessage: string): Promise<void> {
    await this.videoRepository.update(id, {
      status: VideoStatus.FAILED,
      error_message: errorMessage,
    });
  }

  async getDownloadUrl(id: string): Promise<string> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    if (!video.final_video_url) {
      throw new BadRequestException('Video processing is not complete');
    }

    const filename = `${video.id}.mp4`;
    if (video.final_video_url.startsWith('s3://')) {
      return await this.storageService.getSignedUrl(video.final_video_url, 3600, {
        promptDownload: true,
        filename,
      });
    }
    return video.final_video_url;
  }

  private async transformVideoUrls(video: Video): Promise<Video> {
    if (video.final_video_url && video.final_video_url.startsWith('s3://')) {
      video.final_video_url = await this.storageService.getSignedUrl(video.final_video_url);
    }
    if (video.audio_url && video.audio_url.startsWith('s3://')) {
      video.audio_url = await this.storageService.getSignedUrl(video.audio_url);
    }
    if (video.caption_url && video.caption_url.startsWith('s3://')) {
      video.caption_url = await this.storageService.getSignedUrl(video.caption_url);
    }
    if (video.image_urls && video.image_urls.length > 0) {
      video.image_urls = await Promise.all(
        video.image_urls.map(async (url) => {
          if (url.startsWith('s3://')) {
            return await this.storageService.getSignedUrl(url);
          }
          return url;
        }),
      );
    }
    return video;
  }
}
