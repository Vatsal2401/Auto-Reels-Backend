import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Video } from './video.entity';

export enum AssetType {
  VIDEO = 'video',
  IMAGE = 'image',
  AUDIO = 'audio',
  CAPTION = 'caption',
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  video_id: string;

  @ManyToOne(() => Video, (video) => video.assets)
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({
    type: 'enum',
    enum: AssetType,
  })
  asset_type: AssetType;

  @Column({ type: 'text' })
  s3_url: string;

  @Column({ type: 'text' })
  s3_key: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
