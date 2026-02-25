import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum UserNotificationType {
  VIDEO_COMPLETED = 'video_completed',
  VIDEO_FAILED = 'video_failed',
}

@Entity('user_notifications')
@Index(['user_id', 'created_at'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: UserNotificationType,
  })
  type: UserNotificationType;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'video_id', type: 'text', nullable: true })
  video_id: string | null;

  @Column({ name: 'action_href', type: 'text', nullable: true })
  action_href: string | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
