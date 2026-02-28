import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly repo: Repository<UserSettings>,
  ) {}

  async getOrCreate(userId: string): Promise<UserSettings> {
    let settings = await this.repo.findOneBy({ user_id: userId });
    if (!settings) {
      // First access — insert defaults
      settings = await this.repo.save(this.repo.create({ user_id: userId }));
    }
    return settings;
  }

  async isSocialSchedulerEnabled(userId: string): Promise<boolean> {
    const s = await this.getOrCreate(userId);
    return s.social_media_scheduler_enabled;
  }
}
