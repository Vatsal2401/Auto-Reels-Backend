import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Video } from './video.entity';

export enum JobType {
  SCRIPT = 'script',
  AUDIO = 'audio',
  CAPTION = 'caption',
  ASSET = 'asset',
  RENDER = 'render',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  video_id: string;

  @ManyToOne(() => Video, (video) => video.jobs)
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  job_type: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'text', nullable: true })
  bullmq_job_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result_data: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;
}
