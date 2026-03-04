import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ugc_actors')
export class UgcActor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'neutral' })
  gender: string;

  @Column({ type: 'varchar', length: 20, default: 'adult' })
  age_group: string;

  @Column({ type: 'varchar', length: 50, default: 'us' })
  region: string;

  @Column({ type: 'varchar', length: 50, default: 'casual' })
  style: string;

  /** S3 key for actor portrait image (used by Hedra API) */
  @Column({ type: 'text' })
  portrait_s3_key: string;

  /** S3 key for 5-second preview clip shown in selection grid */
  @Column({ type: 'text', nullable: true })
  preview_s3_key: string | null;

  /** ElevenLabs voice ID for this actor (optional override) */
  @Column({ type: 'text', nullable: true })
  voice_id: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'integer', default: 0 })
  usage_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
