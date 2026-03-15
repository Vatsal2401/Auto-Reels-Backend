import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Campaign } from './campaign.entity';
import { ConnectedAccount } from '../../social/entities/connected-account.entity';

@Entity('campaign_accounts')
@Index(['campaign_id'])
@Index(['connected_account_id'])
export class CampaignAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  campaign_id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ name: 'connected_account_id' })
  connected_account_id: string;

  @ManyToOne(() => ConnectedAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_account_id' })
  connected_account: ConnectedAccount;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  is_active: boolean;

  // 1 = highest priority, 10 = lowest — when multiple campaigns share an account,
  // higher priority campaigns get scheduling slots first
  @Column({ type: 'smallint', default: 5 })
  priority: number;

  // Per-campaign limit overrides — NULL means inherit from account_publishing_settings
  @Column({ type: 'smallint', nullable: true, name: 'override_soft_daily_posts' })
  override_soft_daily_posts: number | null;

  @Column({ type: 'smallint', nullable: true, name: 'override_hard_daily_posts' })
  override_hard_daily_posts: number | null;

  @Column({ type: 'smallint', nullable: true, name: 'override_soft_weekly_posts' })
  override_soft_weekly_posts: number | null;

  @Column({ type: 'smallint', nullable: true, name: 'override_hard_weekly_posts' })
  override_hard_weekly_posts: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamp', default: () => 'now()', name: 'added_at' })
  added_at: Date;

  @Column({ type: 'timestamp', default: () => 'now()', name: 'updated_at' })
  updated_at: Date;
}
