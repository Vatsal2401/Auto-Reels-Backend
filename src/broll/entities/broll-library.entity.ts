import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('broll_libraries')
export class BrollLibrary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'video_count', default: 0 })
  videoCount: number;

  @Column({ name: 'indexed_count', default: 0 })
  indexedCount: number;

  @Column({ name: 'scene_count', default: 0 })
  sceneCount: number;

  @Column({ name: 'script_count', default: 0 })
  scriptCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
