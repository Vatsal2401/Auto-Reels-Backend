import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrollScript } from './broll-script.entity';

@Entity('broll_match_results')
export class BrollMatchResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @ManyToOne(() => BrollScript, (s) => s.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'script_id' })
  script: BrollScript;

  @Column({ name: 'line_index' })
  lineIndex: number;

  @Column({ name: 'script_line', type: 'text' })
  scriptLine: string;

  @Column({ name: 'primary_video_id', nullable: true, type: 'uuid' })
  primaryVideoId: string | null;

  @Column({ name: 'primary_filename', type: 'text', nullable: true })
  primaryFilename: string | null;

  @Column({ name: 'primary_s3_key', type: 'text', nullable: true })
  primaryS3Key: string | null;

  @Column({ name: 'primary_frame_time', type: 'float', nullable: true })
  primaryFrameTime: number | null;

  @Column({ name: 'primary_score', type: 'float', nullable: true })
  primaryScore: number | null;

  @Column({ name: 'alt_video_id', nullable: true, type: 'uuid' })
  altVideoId: string | null;

  @Column({ name: 'alt_filename', type: 'text', nullable: true })
  altFilename: string | null;

  @Column({ name: 'alt_frame_time', type: 'float', nullable: true })
  altFrameTime: number | null;

  @Column({ name: 'alt_score', type: 'float', nullable: true })
  altScore: number | null;

  @Column({ name: 'override_video_id', nullable: true, type: 'uuid' })
  overrideVideoId: string | null;

  @Column({ name: 'override_filename', type: 'text', nullable: true })
  overrideFilename: string | null;

  @Column({ name: 'override_s3_key', type: 'text', nullable: true })
  overrideS3Key: string | null;

  @Column({ name: 'override_frame_time', type: 'float', nullable: true })
  overrideFrameTime: number | null;

  @Column({ name: 'override_note', type: 'text', nullable: true })
  overrideNote: string | null;

  @Column({ name: 'is_locked', default: false })
  isLocked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
