import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BlogPost } from './blog-post.entity';

@Entity('blog_likes')
@Unique(['post_id', 'ip_address'])
export class BlogLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  post_id: string;

  @ManyToOne(() => BlogPost, (post) => post.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: BlogPost;

  @Column({ type: 'varchar', length: 64 })
  ip_address: string;
}
