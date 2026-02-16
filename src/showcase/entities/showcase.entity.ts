import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('showcase')
export class Showcase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Media ID for Reel Generator showcase video. */
  @Column({ type: 'uuid', nullable: true })
  reel_media_id: string | null;

  /** Project ID for Graphic Motion showcase video. */
  @Column({ type: 'uuid', nullable: true })
  graphic_motion_project_id: string | null;

  /** URL for Text to Image showcase (absolute URL or path). */
  @Column({ type: 'text', nullable: true })
  text_to_image_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
