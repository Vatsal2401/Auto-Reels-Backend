import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum CampaignGoalType {
  GROW_FOLLOWING = 'grow_following',
  LEAD_GENERATION = 'lead_generation',
  PRODUCT_SALES = 'product_sales',
  BRAND_AWARENESS = 'brand_awareness',
}

@Entity('campaigns')
@Index(['user_id', 'status'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'enum', enum: CampaignGoalType, name: 'goal_type' })
  goal_type: CampaignGoalType;

  @Column({ type: 'text', nullable: true, name: 'goal_description' })
  goal_description: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'visual_style' })
  visual_style: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'icp_criteria' })
  icp_criteria: Record<string, any> | null;

  @Column({ type: 'date', nullable: true, name: 'start_date' })
  start_date: string | null;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  end_date: string | null;

  @Column({ type: 'smallint', default: 1, name: 'posting_cadence_days' })
  posting_cadence_days: number;

  @Column({ type: 'text', array: true, default: '{}', name: 'target_platforms' })
  target_platforms: string[];

  @Column({ type: 'smallint', nullable: true, name: 'quality_score' })
  quality_score: number | null;

  @Column({ type: 'int', default: 0, name: 'cached_total_posts' })
  cached_total_posts: number;

  @Column({ type: 'int', default: 0, name: 'cached_published_posts' })
  cached_published_posts: number;

  // TypeORM returns bigint columns as string
  @Column({ type: 'bigint', default: 0, name: 'cached_total_views' })
  cached_total_views: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'cached_avg_engagement',
  })
  cached_avg_engagement: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
