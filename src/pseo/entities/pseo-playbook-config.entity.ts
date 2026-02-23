import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('pseo_playbook_configs')
export class PseoPlaybookConfig {
  @PrimaryColumn({ type: 'text' })
  playbook: string;

  @Column({ type: 'text' })
  display_name: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 60 })
  min_quality_score: number;

  @Column({ type: 'int', default: 400 })
  min_word_count: number;

  @Column({ type: 'text', nullable: true })
  url_prefix: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
