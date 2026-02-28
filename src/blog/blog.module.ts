import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPost } from './entities/blog-post.entity';
import { BlogComment } from './entities/blog-comment.entity';
import { BlogLike } from './entities/blog-like.entity';
import { BlogAdminNote } from './entities/blog-admin-note.entity';
import { BlogService } from './services/blog.service';
import { BlogCommentService } from './services/blog-comment.service';
import { BlogLikeService } from './services/blog-like.service';
import { BlogAdminController } from './controllers/blog-admin.controller';
import { BlogPublicController } from './controllers/blog-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost, BlogComment, BlogLike, BlogAdminNote])],
  controllers: [BlogAdminController, BlogPublicController],
  providers: [BlogService, BlogCommentService, BlogLikeService],
  exports: [BlogService],
})
export class BlogModule {}
