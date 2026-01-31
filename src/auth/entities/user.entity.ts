import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Video } from '../../video/entities/video.entity';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  avatar_url: string | null;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  auth_provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  provider_id: string | null; // Google/Microsoft user ID

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refresh_token: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verification_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_verification_sent_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  credits_balance: number;

  @Column({ type: 'integer', default: 0 })
  credits_purchased_total: number;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Video, (video) => video.user)
  videos: Video[];
}
