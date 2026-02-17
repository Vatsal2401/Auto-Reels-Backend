import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ShowcaseItemType = 'reel' | 'graphic_motion' | 'text_to_image';

@Entity('showcase_item')
export class ShowcaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: ShowcaseItemType;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  /** For type=reel: source Media id. */
  @Column({ type: 'uuid', nullable: true })
  media_id: string | null;

  /** For type=graphic_motion: source Project id. */
  @Column({ type: 'uuid', nullable: true })
  project_id: string | null;

  /** For reel/graphic_motion: stored clip blob key (optional). */
  @Column({ type: 'text', nullable: true })
  clip_blob_id: string | null;

  /** For type=text_to_image: image URL. */
  @Column({ type: 'text', nullable: true })
  image_url: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
