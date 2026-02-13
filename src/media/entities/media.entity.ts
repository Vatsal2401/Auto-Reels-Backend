import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { MediaStep } from './media-step.entity';
import { MediaAsset } from './media-asset.entity';
import { MediaType, MediaStatus } from '../media.constants';

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MediaType,
  })
  type: MediaType;

  @Column({ type: 'text' })
  flow_key: string;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.PENDING,
  })
  status: MediaStatus;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'jsonb', nullable: true })
  input_config: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  blob_storage_id: string | null;

  @Column({ type: 'text', nullable: true })
  script: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  parent_media_id: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => MediaStep, (step: MediaStep) => step.media)
  steps: Relation<MediaStep[]>;

  @OneToMany(() => MediaAsset, (asset: MediaAsset) => asset.media)
  assets: Relation<MediaAsset[]>;
}
