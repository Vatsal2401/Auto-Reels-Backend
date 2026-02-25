import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ScheduledPost } from './scheduled-post.entity';

export enum LogEvent {
  QUEUED = 'queued',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  UPLOAD_STARTED = 'upload_started',
  UPLOAD_PROGRESS = 'upload_progress',
  UPLOAD_COMPLETE = 'upload_complete',
  PUBLISH_SUCCESS = 'publish_success',
  PUBLISH_FAILED = 'publish_failed',
  CANCELLED = 'cancelled',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RESCHEDULED = 'rescheduled',
}

@Entity('upload_logs')
@Index(['scheduled_post_id', 'created_at'])
export class UploadLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scheduled_post_id' })
  scheduled_post_id: string;

  @ManyToOne(() => ScheduledPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduled_post_id' })
  scheduled_post: ScheduledPost;

  @Column({ type: 'enum', enum: LogEvent })
  event: LogEvent;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attempt_number: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
