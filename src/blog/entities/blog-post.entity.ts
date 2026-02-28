import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { BlogComment } from './blog-comment.entity';
import { BlogLike } from './blog-like.entity';
import { BlogAdminNote } from './blog-admin-note.entity';

export enum BlogPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('blog_posts')
export class BlogPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  content: any;

  @Column({ type: 'text', nullable: true })
  cover_image_url: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  read_time: string;

  @Column({ type: 'text', array: true, nullable: true })
  keywords: string[];

  @Column({
    type: 'enum',
    enum: BlogPostStatus,
    default: BlogPostStatus.DRAFT,
  })
  status: BlogPostStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title: string;

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => BlogComment, (comment) => comment.post)
  comments: BlogComment[];

  @OneToMany(() => BlogLike, (like) => like.post)
  likes: BlogLike[];

  @OneToMany(() => BlogAdminNote, (note) => note.post)
  admin_notes: BlogAdminNote[];
}
