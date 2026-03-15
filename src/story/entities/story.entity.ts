import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  media_id: string | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 50 })
  genre: string;

  @Column({ type: 'integer', default: 5 })
  scene_count: number;

  @CreateDateColumn()
  created_at: Date;
}
