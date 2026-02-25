import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification, UserNotificationType } from './entities/user-notification.entity';

@Injectable()
export class UserNotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  async getForUser(userId: string, limit = 30): Promise<UserNotification[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.update({ id, user_id: userId }, { read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ user_id: userId, read: false }, { read: true });
  }

  async create(params: {
    userId: string;
    type: UserNotificationType;
    title: string;
    message: string;
    videoId?: string;
    actionHref?: string;
  }): Promise<UserNotification> {
    const notification = this.repo.create({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      video_id: params.videoId ?? null,
      action_href: params.actionHref ?? null,
    });
    return this.repo.save(notification);
  }
}
