import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogComment } from '../entities/blog-comment.entity';

@Injectable()
export class BlogCommentService {
  constructor(
    @InjectRepository(BlogComment)
    private readonly commentRepo: Repository<BlogComment>,
  ) {}

  async submitComment(
    postId: string,
    authorName: string,
    authorEmail: string,
    content: string,
  ): Promise<BlogComment> {
    const comment = this.commentRepo.create({
      post_id: postId,
      author_name: authorName,
      author_email: authorEmail,
      content,
    });
    return this.commentRepo.save(comment);
  }

  async approveComment(id: string): Promise<BlogComment> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    comment.is_approved = true;
    return this.commentRepo.save(comment);
  }

  async deleteComment(id: string): Promise<void> {
    await this.commentRepo.delete(id);
  }

  async getCommentsForPost(postId: string, onlyApproved: boolean = true): Promise<BlogComment[]> {
    const query = this.commentRepo
      .createQueryBuilder('comment')
      .where('comment.post_id = :postId', { postId })
      .orderBy('comment.created_at', 'DESC');

    if (onlyApproved) {
      query.andWhere('comment.is_approved = :onlyApproved', { onlyApproved });
    }
    return query.getMany();
  }
}
