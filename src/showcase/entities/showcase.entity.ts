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

  /** Source media for Reel (used when generating clip; optional). */
  @Column({ type: 'uuid', nullable: true })
  reel_media_id: string | null;

  /** S3/storage key for 1–2s reel clip. When set, API returns this instead of full video. */
  @Column({ type: 'text', nullable: true })
  reel_clip_blob_id: string | null;

  /** Source project for Graphic Motion (used when generating clip; optional). */
  @Column({ type: 'uuid', nullable: true })
  graphic_motion_project_id: string | null;

  /** S3/storage key for 1–2s graphic motion clip. When set, API returns this instead of full video. */
  @Column({ type: 'text', nullable: true })
  graphic_motion_clip_blob_id: string | null;

  /** URL for Text to Image showcase (absolute URL or path). */
  @Column({ type: 'text', nullable: true })
  text_to_image_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
