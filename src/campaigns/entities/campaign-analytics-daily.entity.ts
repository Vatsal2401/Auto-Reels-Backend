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
import { Campaign } from './campaign.entity';

@Entity('campaign_analytics_daily')
@Index(['campaign_id', 'date'])
export class CampaignAnalyticsDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  campaign_id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0, name: 'posts_published' })
  posts_published: number;

  @Column({ type: 'int', default: 0, name: 'posts_failed' })
  posts_failed: number;

  // TypeORM returns bigint as string
  @Column({ type: 'bigint', default: 0, name: 'total_views' })
  total_views: string;

  @Column({ type: 'bigint', default: 0, name: 'total_likes' })
  total_likes: string;

  @Column({ type: 'bigint', default: 0, name: 'total_comments' })
  total_comments: string;

  @Column({ type: 'bigint', default: 0, name: 'total_shares' })
  total_shares: string;

  @Column({ type: 'bigint', default: 0, name: 'total_saves' })
  total_saves: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'avg_engagement_rate' })
  avg_engagement_rate: string | null;

  @Column({ type: 'int', default: 0, name: 'followers_gained' })
  followers_gained: number;

  // {"instagram": {"views": 2400, "likes": 180, "posts": 2}, "tiktok": {...}}
  @Column({ type: 'jsonb', default: '{}', name: 'platform_breakdown' })
  platform_breakdown: Record<string, any>;

  // {"reel": {"count": 2, "views": 3100}, "image": {...}}
  @Column({ type: 'jsonb', default: '{}', name: 'content_type_breakdown' })
  content_type_breakdown: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
