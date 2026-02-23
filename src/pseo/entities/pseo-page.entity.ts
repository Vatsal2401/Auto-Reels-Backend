import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PseoPlaybook {
  TEMPLATES = 'templates',
  CURATION = 'curation',
  CONVERSIONS = 'conversions',
  COMPARISONS = 'comparisons',
  EXAMPLES = 'examples',
  LOCATIONS = 'locations',
  PERSONAS = 'personas',
  INTEGRATIONS = 'integrations',
  GLOSSARY = 'glossary',
  TRANSLATIONS = 'translations',
  DIRECTORY = 'directory',
  PROFILES = 'profiles',
}

export enum PseoPageStatus {
  DRAFT = 'draft',
  GENERATING = 'generating',
  GENERATED = 'generated',
  VALIDATING = 'validating',
  PUBLISHED = 'published',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

@Entity('pseo_pages')
@Index('idx_pseo_slug', ['slug'], { unique: true })
@Index('idx_pseo_playbook_status', ['playbook', 'status'])
@Index('idx_pseo_published_at', ['published_at'])
export class PseoPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** URL slug — e.g. "finance-reel-templates" */
  @Column({ type: 'text', unique: true })
  slug: string;

  /** Canonical path — e.g. "/tools/finance-reel-templates" */
  @Column({ type: 'text', unique: true })
  canonical_path: string;

  @Column({ type: 'enum', enum: PseoPlaybook })
  playbook: PseoPlaybook;

  @Column({ type: 'enum', enum: PseoPageStatus, default: PseoPageStatus.DRAFT })
  status: PseoPageStatus;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  meta_description: string;

  @Column({ type: 'text', array: true, default: '{}' })
  keywords: string[];

  /** AI-generated content — schema varies per playbook */
  @Column({ type: 'jsonb', nullable: true })
  content: Record<string, any>;

  /** Seed dimensions used to generate this page — e.g. { niche, platform, tone } */
  @Column({ type: 'jsonb', nullable: true })
  seed_params: Record<string, string>;

  /** Related canonical paths for internal linking */
  @Column({ type: 'text', array: true, default: '{}' })
  related_paths: string[];

  @Column({ type: 'integer', nullable: true })
  word_count: number;

  /** Quality score 0–100 */
  @Column({ type: 'integer', nullable: true })
  quality_score: number;

  @Column({ type: 'integer', default: 0 })
  generation_attempts: number;

  @Column({ type: 'text', nullable: true })
  generation_error: string;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
