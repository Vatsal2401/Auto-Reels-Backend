import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BlogService } from '../services/blog.service';
import { BlogCommentService } from '../services/blog-comment.service';
import { BlogPostStatus } from '../entities/blog-post.entity';
import { AdminJwtGuard } from '../../admin/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../admin/guards/admin-role.guard';

@Controller('admin/blog')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
export class BlogAdminController {
  constructor(
    private readonly blogService: BlogService,
    private readonly commentService: BlogCommentService,
  ) {}

  @Get()
  async listPosts(
    @Query('status') status?: BlogPostStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.blogService.getPosts(
      status,
      search,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('stats')
  async getStats() {
    return this.blogService.getStats();
  }

  @Post()
  async createPost(@Body() data: any) {
    return this.blogService.createPost(data);
  }

  @Get(':id')
  async getPost(@Param('id') id: string) {
    return this.blogService.getPostById(id);
  }

  @Patch(':id')
  async updatePost(@Param('id') id: string, @Body() data: any) {
    return this.blogService.updatePost(id, data);
  }

  @Delete(':id')
  async archivePost(@Param('id') id: string) {
    return this.blogService.archivePost(id);
  }

  @Post(':id/publish')
  async publishPost(@Param('id') id: string) {
    return this.blogService.publishPost(id);
  }

  @Post(':id/unpublish')
  async unpublishPost(@Param('id') id: string) {
    return this.blogService.unpublishPost(id);
  }

  @Get(':id/comments')
  async listComments(@Param('id') id: string, @Query('approved') approved?: string) {
    const onlyApproved = approved === 'true' ? true : approved === 'false' ? false : undefined;

    // getCommentsForPost accepts a boolean, if not provided maybe it should return all.
    // I need to adjust commentService method slightly to support returning all if onlyApproved is undefined.
    // As passed onlyApproved=false means unapproved only. Let's assume undefined means return all.
    const query = this.commentService['commentRepo']
      .createQueryBuilder('comment')
      .where('comment.post_id = :postId', { postId: id })
      .orderBy('comment.created_at', 'DESC');

    if (approved === 'true') {
      query.andWhere('comment.is_approved = true');
    } else if (approved === 'false') {
      query.andWhere('comment.is_approved = false');
    }

    return query.getMany();
  }

  @Patch('comments/:cid/approve')
  async approveComment(@Param('cid') cid: string) {
    return this.commentService.approveComment(cid);
  }

  @Delete('comments/:cid')
  async deleteComment(@Param('cid') cid: string) {
    return this.commentService.deleteComment(cid);
  }

  @Get(':id/notes')
  async listNotes(@Param('id') id: string) {
    return this.blogService.getNotesForPost(id);
  }

  @Post(':id/notes')
  async addNote(@Param('id') id: string, @Body() body: { note: string }, @Req() req: any) {
    const adminId = req.user.id;
    return this.blogService.addNoteToPost(id, adminId, body.note);
  }
}
