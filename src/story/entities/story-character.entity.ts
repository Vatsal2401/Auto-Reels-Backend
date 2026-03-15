import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('story_characters')
export class StoryCharacter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  story_id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  appearance: string;

  @Column({ type: 'text', nullable: true })
  clothing: string | null;

  @Column({ type: 'text', nullable: true })
  style: string | null;

  @Column({ type: 'text' })
  consistency_anchor: string;
}
