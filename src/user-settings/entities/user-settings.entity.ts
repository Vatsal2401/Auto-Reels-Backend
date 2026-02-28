import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_settings')
export class UserSettings {
  // 1:1 with User — user_id is both PK and FK (no separate UUID)
  @PrimaryColumn('uuid')
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Feature flags — default false, enabled manually via DB
  @Column({ name: 'social_media_scheduler_enabled', type: 'boolean', default: false })
  social_media_scheduler_enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
