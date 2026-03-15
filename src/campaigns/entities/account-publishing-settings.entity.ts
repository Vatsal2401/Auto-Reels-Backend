import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ConnectedAccount } from '../../social/entities/connected-account.entity';

@Entity('account_publishing_settings')
export class AccountPublishingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'connected_account_id' })
  connected_account_id: string;

  @OneToOne(() => ConnectedAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_account_id' })
  connected_account: ConnectedAccount;

  // ── Soft limits — warn but allow ──────────────────────────────────
  @Column({ type: 'smallint', default: 3, name: 'soft_daily_posts' })
  soft_daily_posts: number;

  @Column({ type: 'smallint', default: 10, name: 'soft_weekly_posts' })
  soft_weekly_posts: number;

  @Column({ type: 'smallint', default: 35, name: 'soft_monthly_posts' })
  soft_monthly_posts: number;

  // ── Hard limits — block scheduling ────────────────────────────────
  @Column({ type: 'smallint', default: 5, name: 'hard_daily_posts' })
  hard_daily_posts: number;

  @Column({ type: 'smallint', default: 20, name: 'hard_weekly_posts' })
  hard_weekly_posts: number;

  @Column({ type: 'smallint', default: 60, name: 'hard_monthly_posts' })
  hard_monthly_posts: number;

  // [{weekday: 0-6, hour: 0-23, minute: 0-59}]
  @Column({ type: 'jsonb', default: '[]', name: 'preferred_posting_times' })
  preferred_posting_times: Array<{ weekday: number; hour: number; minute: number }>;

  // IANA timezone string e.g. "Asia/Kolkata"
  @Column({ type: 'varchar', length: 60, default: 'UTC' })
  timezone: string;

  // Minimum gap between any two posts for this account (across all campaigns)
  @Column({ type: 'smallint', default: 4, name: 'min_hours_between_posts' })
  min_hours_between_posts: number;

  // Keyed by platform: {"instagram": {"max_hashtags": 10}}
  @Column({ type: 'jsonb', default: '{}', name: 'platform_overrides' })
  platform_overrides: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
