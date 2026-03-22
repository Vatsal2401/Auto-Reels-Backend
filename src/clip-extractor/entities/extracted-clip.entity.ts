import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClipExtractJob, WhisperWord } from './clip-extract-job.entity';

export enum ClipRenderStatus {
  PENDING = 'pending',
  RENDERING = 'rendering',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity('extracted_clips')
export class ExtractedClip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id' })
  job_id: string;

  @ManyToOne(() => ClipExtractJob, (job) => job.clips, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: ClipExtractJob;

  @Column({ type: 'int' })
  clip_index: number;

  @Column({ type: 'float' })
  viral_score: number;

  @Column({ type: 'text', nullable: true })
  hook_line: string | null;

  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'float' })
  start_sec: number;

  @Column({ type: 'float' })
  end_sec: number;

  @Column({ type: 'float', nullable: true })
  duration_sec: number | null;

  @Column({ type: 'text', nullable: true })
  raw_clip_s3_key: string | null;

  @Column({ type: 'text', nullable: true })
  rendered_clip_s3_key: string | null;

  @Column({ type: 'text', nullable: true })
  thumbnail_s3_key: string | null;

  @Column({ type: 'jsonb', nullable: true })
  word_timings: WhisperWord[] | null;

  @Column({
    type: 'enum',
    enum: ClipRenderStatus,
    default: ClipRenderStatus.PENDING,
  })
  render_status: ClipRenderStatus;

  @Column({ type: 'text', nullable: true })
  render_error: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
