import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum SocialPlatform {
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
}

@Entity('connected_accounts')
@Index(['user_id', 'platform', 'platform_account_id'], { unique: true })
export class ConnectedAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: SocialPlatform })
  platform: SocialPlatform;

  @Column({ name: 'platform_account_id', type: 'text' })
  platform_account_id: string;

  @Column({ name: 'account_name', type: 'text', nullable: true })
  account_name: string | null;

  @Column({ name: 'account_avatar_url', type: 'text', nullable: true })
  account_avatar_url: string | null;

  @Column({ name: 'access_token_enc', type: 'text' })
  access_token_enc: string;

  @Column({ name: 'refresh_token_enc', type: 'text', nullable: true })
  refresh_token_enc: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  token_expires_at: Date | null;

  // 'short_lived' | 'long_lived' — only relevant for Instagram
  @Column({ name: 'token_type', type: 'text', nullable: true })
  token_type: string | null;

  @Column({ name: 'scopes', type: 'text', nullable: true })
  scopes: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'needs_reauth', type: 'boolean', default: false })
  needs_reauth: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
