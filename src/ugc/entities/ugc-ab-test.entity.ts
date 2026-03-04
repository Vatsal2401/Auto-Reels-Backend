import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ugc_ab_tests')
@Index('idx_ugc_ab_parent', ['parent_media_id'])
export class UgcAbTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The original media ID that spawned this A/B test */
  @Column({ type: 'uuid' })
  parent_media_id: string;

  /** The variant media ID (each variant is a separate media row) */
  @Column({ type: 'uuid' })
  variant_media_id: string;

  /** 'hook' | 'actor' | 'style' */
  @Column({ type: 'varchar', length: 50, default: 'hook' })
  variant_type: string;

  /** Human-readable label for this variant (e.g. "Hook B - question style") */
  @Column({ type: 'text', nullable: true })
  variant_label: string | null;

  @Column({ type: 'integer', default: 0 })
  view_count: number;

  @Column({ type: 'integer', default: 0 })
  click_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
