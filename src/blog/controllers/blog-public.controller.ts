import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { BlogService } from '../services/blog.service';
import { BlogLikeService } from '../services/blog-like.service';
import { BlogCommentService } from '../services/blog-comment.service';
import { BlogPostStatus } from '../entities/blog-post.entity';

@Controller('blog')
export class BlogPublicController {
  constructor(
    private readonly blogService: BlogService,
    private readonly likeService: BlogLikeService,
    private readonly commentService: BlogCommentService,
  ) {}

  @Get()
  async listPublicPosts(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.blogService.getPosts(
      BlogPostStatus.PUBLISHED,
      undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':slug')
  async getPost(@Param('slug') slug: string) {
    const post = await this.blogService.getPostBySlug(slug);
    await this.blogService.incrementViews(slug);
    // increment won't update the current instance, so manually set +1 to return
    post.views += 1;
    return post;
  }

  @Post(':slug/like')
  async likePost(@Param('slug') slug: string, @Req() req: any) {
    const post = await this.blogService.getPostBySlug(slug);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // We handle logic manually if x-forwarded-for has multiple IPs
    const clientIp = typeof ip === 'string' ? ip.split(',')[0].trim() : ip[0];

    return this.likeService.likePost(post.id, clientIp);
  }

  @Post(':slug/comments')
  async submitComment(
    @Param('slug') slug: string,
    @Body() body: { author_name: string; author_email: string; content: string },
  ) {
    const post = await this.blogService.getPostBySlug(slug);
    return this.commentService.submitComment(
      post.id,
      body.author_name,
      body.author_email,
      body.content,
    );
  }
}
