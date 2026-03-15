import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_settings')
export class UserSettings {
  // 1:1 with User — user_id is both PK and FK (no separate UUID)
  @PrimaryColumn('uuid')
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Feature flags — default false, enabled manually via DB
  @Column({ name: 'social_media_scheduler_enabled', type: 'boolean', default: false })
  social_media_scheduler_enabled: boolean;

  @Column({ name: 'has_completed_onboarding', type: 'boolean', default: false })
  has_completed_onboarding: boolean;

  @Column({ name: 'image_to_video_enabled', type: 'boolean', default: false })
  image_to_video_enabled: boolean;

  @Column({ name: 'lipsync_enabled', type: 'boolean', default: false })
  lipsync_enabled: boolean;

  @Column({ name: 'ugc_enabled', type: 'boolean', default: false })
  ugc_enabled: boolean;

  @Column({ name: 'story_reel_enabled', type: 'boolean', default: false })
  story_reel_enabled: boolean;

  @Column({ name: 'broll_enabled', type: 'boolean', default: false })
  broll_enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
