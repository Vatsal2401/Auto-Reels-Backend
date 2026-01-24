import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Videos')
@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new video' })
  @ApiResponse({ status: 201, description: 'Video created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - insufficient credits or invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createVideo(@Body() dto: CreateVideoDto, @CurrentUser() user: any) {
    const video = await this.videoService.createVideo(dto, user.userId);
    // Note: Enqueueing will be handled by a service method
    return {
      video_id: video.id,
      status: video.status,
      topic: video.topic,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all videos for the current user' })
  @ApiResponse({ status: 200, description: 'List of videos' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getVideos(@CurrentUser() user: any) {
    const videos = await this.videoService.getUserVideos(user.userId);
    return videos.map((video) => ({
      id: video.id,
      status: video.status,
      topic: video.topic,
      script: video.script,
      final_video_url: video.final_video_url,
      error_message: video.error_message,
      created_at: video.created_at,
      completed_at: video.completed_at,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get video by ID' })
  @ApiResponse({ status: 200, description: 'Video details' })
  @ApiResponse({ status: 404, description: 'Video not found' })
  async getVideo(@Param('id') id: string) {
    const video = await this.videoService.getVideo(id);
    return {
      id: video.id,
      status: video.status,
      topic: video.topic,
      script: video.script,
      final_video_url: video.final_video_url,
      error_message: video.error_message,
      created_at: video.created_at,
      completed_at: video.completed_at,
    };
  }
}
