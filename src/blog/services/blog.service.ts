import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPost, BlogPostStatus } from '../entities/blog-post.entity';
import { BlogAdminNote } from '../entities/blog-admin-note.entity';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogPostRepo: Repository<BlogPost>,
    @InjectRepository(BlogAdminNote)
    private readonly blogAdminNoteRepo: Repository<BlogAdminNote>,
  ) {}

  async createPost(data: Partial<BlogPost>): Promise<BlogPost> {
    const post = this.blogPostRepo.create(data);
    if (!post.slug) {
      post.slug = post.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
    return this.blogPostRepo.save(post);
  }

  async publishPost(id: string): Promise<BlogPost> {
    const post = await this.getPostById(id);
    post.status = BlogPostStatus.PUBLISHED;
    post.published_at = new Date();
    return this.blogPostRepo.save(post);
  }

  async unpublishPost(id: string): Promise<BlogPost> {
    const post = await this.getPostById(id);
    post.status = BlogPostStatus.DRAFT;
    return this.blogPostRepo.save(post);
  }

  async archivePost(id: string): Promise<BlogPost> {
    const post = await this.getPostById(id);
    post.status = BlogPostStatus.ARCHIVED;
    return this.blogPostRepo.save(post);
  }

  async updatePost(id: string, data: Partial<BlogPost>): Promise<BlogPost> {
    const post = await this.getPostById(id);
    Object.assign(post, data);
    return this.blogPostRepo.save(post);
  }

  async getPostById(id: string): Promise<BlogPost> {
    const post = await this.blogPostRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async getPostBySlug(slug: string): Promise<BlogPost & { comments: any[] }> {
    const post = await this.blogPostRepo.findOne({
      where: { slug, status: BlogPostStatus.PUBLISHED },
      relations: ['comments'],
    });
    if (!post) throw new NotFoundException('Blog post not found');
    // Only expose approved comments to the public
    (post as any).comments = (post.comments ?? []).filter((c) => c.is_approved);
    return post as any;
  }

  async incrementViews(slug: string): Promise<void> {
    await this.blogPostRepo.increment({ slug }, 'views', 1);
  }

  async getPosts(
    status?: BlogPostStatus,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: BlogPost[]; count: number }> {
    const query = this.blogPostRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.likes', 'likes')
      .leftJoinAndSelect('post.comments', 'comments');

    if (status) {
      query.andWhere('post.status = :status', { status });
    }
    if (search) {
      query.andWhere('post.title ILIKE :search', { search: `%${search}%` });
    }

    query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('post.created_at', 'DESC');

    const [data, count] = await query.getManyAndCount();
    return { data, count };
  }

  async getStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    views: number;
    likes: number;
  }> {
    const stats = await this.blogPostRepo
      .createQueryBuilder('post')
      .select('COUNT(post.id)', 'total')
      .addSelect(
        `SUM(CASE WHEN post.status = '${BlogPostStatus.PUBLISHED}' THEN 1 ELSE 0 END)`,
        'published',
      )
      .addSelect(
        `SUM(CASE WHEN post.status = '${BlogPostStatus.DRAFT}' THEN 1 ELSE 0 END)`,
        'draft',
      )
      .addSelect('COALESCE(SUM(post.views), 0)', 'views')
      .addSelect('COALESCE(SUM(post.likes_count), 0)', 'likes')
      .getRawOne();

    return {
      total: Number(stats?.total || 0),
      published: Number(stats?.published || 0),
      draft: Number(stats?.draft || 0),
      views: Number(stats?.views || 0),
      likes: Number(stats?.likes || 0),
    };
  }

  async addNoteToPost(postId: string, adminId: string, note: string): Promise<BlogAdminNote> {
    const adminNote = this.blogAdminNoteRepo.create({ post_id: postId, admin_id: adminId, note });
    return this.blogAdminNoteRepo.save(adminNote);
  }

  async getNotesForPost(postId: string): Promise<BlogAdminNote[]> {
    return this.blogAdminNoteRepo.find({
      where: { post_id: postId },
      order: { created_at: 'DESC' },
    });
  }
}
