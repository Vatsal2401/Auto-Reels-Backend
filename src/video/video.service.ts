import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './entities/video.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class VideoService {
  private readonly CREDITS_PER_VIDEO = 1;

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    private creditsService: CreditsService,
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
    return video;
  }

  async getUserVideos(userId: string): Promise<Video[]> {
    return await this.videoRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
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
}
