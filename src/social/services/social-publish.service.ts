import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedAccount } from '../entities/connected-account.entity';
import { ScheduledPost, PostStatus } from '../entities/scheduled-post.entity';
import { UploadLog, LogEvent } from '../entities/upload-log.entity';
import { SocialPublishQueueService } from '../queues/social-publish-queue.service';
import { SchedulePostDto } from '../dto/schedule-post.dto';

@Injectable()
export class SocialPublishService {
  private readonly logger = new Logger(SocialPublishService.name);

  constructor(
    @InjectRepository(ConnectedAccount)
    private readonly connectedAccountRepo: Repository<ConnectedAccount>,
    @InjectRepository(ScheduledPost)
    private readonly scheduledPostRepo: Repository<ScheduledPost>,
    @InjectRepository(UploadLog)
    private readonly uploadLogRepo: Repository<UploadLog>,
    private readonly queueService: SocialPublishQueueService,
  ) {}

  async schedulePost(userId: string, dto: SchedulePostDto): Promise<ScheduledPost> {
    const account = await this.connectedAccountRepo.findOne({
      where: { id: dto.connectedAccountId, user_id: userId },
    });

    if (!account) throw new NotFoundException('Connected account not found');

    // Guard: block scheduling to accounts that need reauth (C5)
    if (!account.is_active || account.needs_reauth) {
      throw new BadRequestException(
        `Reconnect your ${account.platform} account before scheduling.`,
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const post = await this.scheduledPostRepo.save(
      this.scheduledPostRepo.create({
        user_id: userId,
        connected_account_id: dto.connectedAccountId,
        platform: dto.platform,
        video_s3_key: dto.videoS3Key,
        video_topic: dto.videoTopic,
        scheduled_at: scheduledAt,
        status: PostStatus.PENDING,
        publish_options: dto.publishOptions ?? null,
      }),
    );

    await this.queueService.schedulePost(post.id, dto.platform, scheduledAt);

    await this.uploadLogRepo.save(
      this.uploadLogRepo.create({
        scheduled_post_id: post.id,
        event: LogEvent.QUEUED,
        metadata: { platform: dto.platform, scheduledAt: scheduledAt.toISOString() },
      }),
    );

    return post;
  }

  async cancelPost(userId: string, postId: string): Promise<void> {
    // Set status CANCELLED first — then remove from queue (H6)
    const updated = await this.scheduledPostRepo
      .createQueryBuilder()
      .update(ScheduledPost)
      .set({ status: PostStatus.CANCELLED })
      .where('id = :id AND user_id = :userId AND status = :pending', {
        id: postId,
        userId,
        pending: PostStatus.PENDING,
      })
      .execute();

    if (updated.affected === 0) {
      throw new ConflictException(
        'Post cannot be cancelled (already uploading, completed, or not found)',
      );
    }

    const post = await this.scheduledPostRepo.findOneBy({ id: postId });
    if (post) {
      await this.queueService.cancelPost(postId, post.platform).catch(() => {});
    }
  }

  async listPosts(userId: string, status?: PostStatus): Promise<ScheduledPost[]> {
    const where: any = { user_id: userId };
    if (status) where.status = status;
    return this.scheduledPostRepo.find({
      where,
      order: { scheduled_at: 'DESC' },
      take: 50,
    });
  }

  async getPost(userId: string, postId: string): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepo.findOne({
      where: { id: postId, user_id: userId },
    });
    if (!post) throw new NotFoundException('Scheduled post not found');
    return post;
  }

  async getLogs(userId: string, postId: string): Promise<UploadLog[]> {
    const post = await this.getPost(userId, postId);
    return this.uploadLogRepo.find({
      where: { scheduled_post_id: post.id },
      order: { created_at: 'ASC' },
    });
  }
}
