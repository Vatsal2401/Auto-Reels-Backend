import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('background_music')
export class BackgroundMusic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  blob_storage_id: string;

  @Column({ type: 'text', nullable: true })
  category: string; // Motivational, Sad, etc.

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null; // Null for system/sample music

  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
