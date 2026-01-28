import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from './job.entity';
import { Asset } from './asset.entity';
import { User } from '../../auth/entities/user.entity';

export enum VideoStatus {
  PENDING = 'pending',
  SCRIPT_GENERATING = 'script_generating',
  SCRIPT_COMPLETE = 'script_complete',
  PROCESSING = 'processing',
  RENDERING = 'rendering',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'text' })
  topic: string;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @Column({ type: 'text', nullable: true })
  script: string | null;

  @Column({ type: 'jsonb', nullable: true })
  script_json: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  script_generated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  audio_url: string | null;

  @Column({ type: 'text', nullable: true })
  caption_url: string | null;

  @Column({ type: 'jsonb', nullable: true })
  asset_urls: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  image_urls: string[] | null;

  @Column({ type: 'text', nullable: true })
  generated_video_url: string | null;

  @Column({ type: 'text', nullable: true })
  final_video_url: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @OneToMany(() => Job, (job) => job.video)
  jobs: Job[];

  @OneToMany(() => Asset, (asset) => asset.video)
  assets: Asset[];
}
