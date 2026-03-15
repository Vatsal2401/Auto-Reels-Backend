import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('broll_air_imports')
export class BrollAirImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'library_id' })
  libraryId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'board_url', type: 'text' })
  boardUrl: string;

  @Column({ name: 'board_id' })
  boardId: string;

  @Column({ default: 'running', length: 20 })
  status: string;

  @Column({ name: 'total_clips', default: 0 })
  totalClips: number;

  @Column({ name: 'imported_clips', default: 0 })
  importedClips: number;

  @Column({ name: 'failed_clips', default: 0 })
  failedClips: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
