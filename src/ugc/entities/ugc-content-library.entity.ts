import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type UgcClipType = 'broll' | 'reaction' | 'product_close' | 'hands' | 'lifestyle';

@Entity('ugc_content_library')
@Index('idx_ugc_content_type', ['clip_type'])
export class UgcContentLibrary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', unique: true })
  s3_key: string;

  @Column({ type: 'varchar', length: 50, default: 'broll' })
  clip_type: UgcClipType;

  /** GIN-indexed tags for content matching (e.g. ['beauty','skincare']) */
  @Column({ type: 'text', array: true, default: '{}' })
  category_tags: string[];

  @Column({ type: 'float', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'text', nullable: true })
  thumbnail_s3_key: string | null;

  @Column({ type: 'integer', default: 0 })
  usage_count: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
