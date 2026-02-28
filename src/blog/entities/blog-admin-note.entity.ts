import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { BlogPost } from './blog-post.entity';
// Assuming you have an AdminUser entity in auth/entities
// Update import if AdminUser is located somewhere else, falling back to a plain uuid column
// import { AdminUser } from '../../auth/entities/admin-user.entity';

@Entity('blog_admin_notes')
export class BlogAdminNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  post_id: string;

  @ManyToOne(() => BlogPost, (post) => post.admin_notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: BlogPost;

  @Column({ type: 'uuid' })
  admin_id: string;

  // @ManyToOne(() => AdminUser)
  // @JoinColumn({ name: 'admin_id' })
  // admin: AdminUser;

  @Column({ type: 'text' })
  note: string;

  @CreateDateColumn()
  created_at: Date;
}
