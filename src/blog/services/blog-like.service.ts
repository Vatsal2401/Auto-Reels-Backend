import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogLike } from '../entities/blog-like.entity';
import { BlogPost } from '../entities/blog-post.entity';

@Injectable()
export class BlogLikeService {
  constructor(
    @InjectRepository(BlogLike)
    private readonly likeRepo: Repository<BlogLike>,
    @InjectRepository(BlogPost)
    private readonly postRepo: Repository<BlogPost>,
  ) {}

  async likePost(postId: string, ipAddress: string): Promise<boolean> {
    const existing = await this.likeRepo.findOne({
      where: { post_id: postId, ip_address: ipAddress },
    });
    if (existing) {
      return false; // Already liked
    }

    const like = this.likeRepo.create({ post_id: postId, ip_address: ipAddress });
    await this.likeRepo.save(like);
    await this.postRepo.increment({ id: postId }, 'likes_count', 1);

    return true;
  }
}
