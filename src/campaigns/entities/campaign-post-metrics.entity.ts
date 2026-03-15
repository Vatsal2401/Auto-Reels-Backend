import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CampaignPost } from './campaign-post.entity';
import { ConnectedAccount } from '../../social/entities/connected-account.entity';

@Entity('campaign_post_metrics')
@Index(['campaign_post_id'])
@Index(['connected_account_id', 'platform'])
export class CampaignPostMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_post_id' })
  campaign_post_id: string;

  @ManyToOne(() => CampaignPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_post_id' })
  campaign_post: CampaignPost;

  // One metrics row per scheduled_post (UNIQUE constraint in DB)
  @Column({ name: 'scheduled_post_id' })
  scheduled_post_id: string;
  // Not mapped as TypeORM relation to avoid circular dependency with social module

  @Column({ type: 'varchar', length: 20 })
  platform: string;

  @Column({ name: 'connected_account_id' })
  connected_account_id: string;

  @ManyToOne(() => ConnectedAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_account_id' })
  connected_account: ConnectedAccount;

  // TypeORM returns bigint as string
  @Column({ type: 'bigint', default: 0 })
  views: string;

  @Column({ type: 'bigint', default: 0 })
  likes: string;

  @Column({ type: 'bigint', default: 0 })
  comments: string;

  @Column({ type: 'bigint', default: 0 })
  shares: string;

  @Column({ type: 'bigint', default: 0 })
  saves: string;

  @Column({ type: 'bigint', default: 0 })
  reach: string;

  @Column({ type: 'bigint', default: 0 })
  impressions: string;

  @Column({ type: 'int', default: 0, name: 'followers_gained' })
  followers_gained: number;

  // (likes + comments + shares) / views * 100
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'engagement_rate' })
  engagement_rate: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()', name: 'metrics_fetched_at' })
  metrics_fetched_at: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
