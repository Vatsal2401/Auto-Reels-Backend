import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('story_scenes')
export class StoryScene {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  story_id: string;

  @Column({ type: 'integer' })
  scene_number: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  image_prompt: string | null;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  narration: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  camera_motion: string | null;

  @Column({ type: 'text', nullable: true })
  image_url: string | null;

  @Column({ type: 'float', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'float', nullable: true })
  start_time_seconds: number | null;
}
