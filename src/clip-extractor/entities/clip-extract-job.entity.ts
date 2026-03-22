import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ExtractedClip } from './extracted-clip.entity';

export enum ClipExtractStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  TRANSCRIBING = 'transcribing',
  ANALYZING = 'analyzing',
  CLIPPING = 'clipping',
  RENDERING = 'rendering',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
}

export type CaptionStyle = 'bold' | 'minimal' | 'neon' | 'classic';

export interface ClipExtractOptions {
  maxClips: number;
  minClipSec: number;
  maxClipSec: number;
  removeSilence: boolean;
  captionStyle: CaptionStyle;
  splitScreenBroll: boolean;
  brollLibraryId?: string;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

@Entity('clip_extract_jobs')
export class ClipExtractJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @Column({ type: 'text' })
  source_url: string;

  @Column({
    type: 'enum',
    enum: ClipExtractStatus,
    default: ClipExtractStatus.PENDING,
  })
  status: ClipExtractStatus;

  @Column({ type: 'int', default: 0 })
  progress_pct: number;

  @Column({ type: 'text', nullable: true })
  current_stage: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'text', nullable: true })
  source_video_s3_key: string | null;

  @Column({ type: 'jsonb', nullable: true })
  transcript_words: WhisperWord[] | null;

  @Column({ type: 'int', nullable: true })
  source_video_duration_sec: number | null;

  @Column({ type: 'text', nullable: true })
  video_title: string | null;

  @Column({ type: 'jsonb' })
  options: ClipExtractOptions;

  @Column({ type: 'int', default: 0 })
  credits_reserved: number;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @OneToMany(() => ExtractedClip, (clip) => clip.job)
  clips: ExtractedClip[];
}
