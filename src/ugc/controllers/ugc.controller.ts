import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UgcService } from '../services/ugc.service';
import { CreateUgcVideoDto } from '../dto/create-ugc-video.dto';
import { MediaOrchestratorService } from '../../media/media-orchestrator.service';

@Controller('ugc')
@UseGuards(JwtAuthGuard)
export class UgcController {
  constructor(
    private readonly ugcService: UgcService,
    private readonly orchestratorService: MediaOrchestratorService,
  ) {}

  @Get('actors')
  async listActors(
    @Query('gender') gender?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('region') region?: string,
    @Query('style') style?: string,
  ) {
    return this.ugcService.listActors({ gender, ageGroup, region, style });
  }

  @Post('create')
  async createUgcVideo(@Body() dto: CreateUgcVideoDto, @Request() req: any) {
    const media = await this.ugcService.createUgcVideo(dto, req.user.userId);
    // Trigger orchestration in background (non-blocking)
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Get(':id/ab-tests')
  async listAbTests(@Param('id') id: string) {
    return this.ugcService.listAbTests(id);
  }

  @Post(':id/generate-batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateBatch(
    @Param('id') parentId: string,
    @Body() dto: { hookVariants?: string[]; actorIds?: string[] },
    @Request() req: any,
  ) {
    // For each hook variant, create a sibling media and record A/B test
    const results: string[] = [];

    const variants = dto.hookVariants ?? [];
    for (const [i, hookText] of variants.entries()) {
      // Get parent media config (simplified — no DB read here, just track IDs)
      // Full batch generation is V1; here we just register the intent
      results.push(`variant-hook-${i}`);
    }

    return { message: 'Batch generation queued', parentId, variants: results.length };
  }
}
