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
import { Campaign } from './campaign.entity';

export enum CampaignPostType {
  REEL = 'reel',
  CAROUSEL = 'carousel',
  STORY = 'story',
  UGC_VIDEO = 'ugc_video',
  IMAGE = 'image',
  GRAPHIC_MOTION = 'graphic_motion',
}

export enum ContentSource {
  NEW = 'new',
  EXISTING = 'existing',
}

export enum CampaignPostPipelineStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  READY = 'ready',
  AWAITING_SCHEDULE = 'awaiting_schedule',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

@Entity('campaign_posts')
@Index(['campaign_id', 'day_number', 'sort_order'])
@Index(['pipeline_status'])
export class CampaignPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  campaign_id: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ type: 'int', name: 'day_number' })
  day_number: number;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sort_order: number;

  @Column({ type: 'enum', enum: CampaignPostType, name: 'post_type' })
  post_type: CampaignPostType;

  @Column({ type: 'enum', enum: ContentSource, default: ContentSource.NEW, name: 'content_source' })
  content_source: ContentSource;

  @Column({ type: 'varchar', length: 40, nullable: true, name: 'source_entity_type' })
  source_entity_type: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'source_entity_id' })
  source_entity_id: string | null;

  // Final rendered asset S3 key — populated after render pipeline completes
  @Column({ type: 'text', nullable: true, name: 'rendered_s3_key' })
  rendered_s3_key: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'render_job_id' })
  render_job_id: string | null;

  @Column({ type: 'text', nullable: true, name: 'render_error' })
  render_error: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'ai_generation_job_id' })
  ai_generation_job_id: string | null;

  @Column({ type: 'text', nullable: true, name: 'ai_generation_error' })
  ai_generation_error: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  hook: string | null;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ type: 'text', nullable: true })
  script: string | null;

  @Column({ type: 'text', nullable: true })
  hashtags: string | null;

  @Column({ type: 'text', array: true, default: '{}', name: 'target_platforms' })
  target_platforms: string[];

  @Column({
    type: 'enum',
    enum: CampaignPostPipelineStatus,
    default: CampaignPostPipelineStatus.DRAFT,
    name: 'pipeline_status',
  })
  pipeline_status: CampaignPostPipelineStatus;

  @Column({ type: 'text', nullable: true, name: 'pipeline_error' })
  pipeline_error: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'scheduled_at' })
  scheduled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  published_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
