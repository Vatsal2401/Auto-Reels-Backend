import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StoryService } from '../services/story.service';
import { CreateStoryDto } from '../dto/create-story.dto';
import { MediaOrchestratorService } from '../../media/media-orchestrator.service';

@Controller('story')
@UseGuards(JwtAuthGuard)
export class StoryController {
  constructor(
    private readonly storyService: StoryService,
    private readonly orchestratorService: MediaOrchestratorService,
  ) {}

  @Post('create')
  async createStory(@Body() dto: CreateStoryDto, @Request() req: any) {
    const media = await this.storyService.createStory(dto, req.user.userId);
    // Trigger orchestration in background (non-blocking)
    this.orchestratorService.processMedia(media.id);
    return { id: media.id, media_id: media.id, status: media.status };
  }

  @Get(':mediaId')
  async getStory(@Param('mediaId') mediaId: string, @Request() req: any) {
    // Delegates to existing media endpoint — client should poll GET /media/:id
    return { media_id: mediaId };
  }
}
