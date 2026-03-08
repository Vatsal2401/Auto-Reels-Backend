import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('broll_ingestion_jobs')
export class BrollIngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'video_id' })
  videoId: string;

  @Column({ name: 'library_id' })
  libraryId: string;

  @Column({ default: 'queued' })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  stage: string | null;

  @Column({ name: 'frames_processed', default: 0 })
  framesProcessed: number;

  @Column({ name: 'total_frames', type: 'int', nullable: true })
  totalFrames: number | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
