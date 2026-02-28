import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { BlogPost } from './blog-post.entity';

@Entity('blog_comments')
export class BlogComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  post_id: string;

  @ManyToOne(() => BlogPost, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: BlogPost;

  @Column({ type: 'varchar', length: 100 })
  author_name: string;

  @Column({ type: 'varchar', length: 255 })
  author_email: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  is_approved: boolean;

  @CreateDateColumn()
  created_at: Date;
}
