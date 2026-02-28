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
import { User } from '../../auth/entities/user.entity';
import { ConnectedAccount, SocialPlatform } from './connected-account.entity';

export enum PostStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('scheduled_posts')
@Index(['user_id', 'scheduled_at'])
@Index(['status', 'scheduled_at'])
export class ScheduledPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'connected_account_id' })
  connected_account_id: string;

  @ManyToOne(() => ConnectedAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connected_account_id' })
  connected_account: ConnectedAccount;

  @Column({ type: 'enum', enum: SocialPlatform })
  platform: SocialPlatform;

  @Column({ name: 'video_s3_key', type: 'text' })
  video_s3_key: string;

  @Column({ name: 'video_topic', type: 'text', nullable: true })
  video_topic: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduled_at: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.PENDING,
  })
  status: PostStatus;

  @Column({ name: 'platform_post_id', type: 'text', nullable: true })
  platform_post_id: string | null;

  @Column({ name: 'publish_options', type: 'jsonb', nullable: true })
  publish_options: Record<string, any> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  error_message: string | null;

  @Column({ name: 'upload_progress_pct', type: 'int', default: 0 })
  upload_progress_pct: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
