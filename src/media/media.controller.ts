import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Patch,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaOrchestratorService } from './media-orchestrator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly orchestratorService: MediaOrchestratorService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createMedia(@Body() dto: any, @Request() req: any) {
    const media = await this.mediaService.createMedia(dto, req.user.userId);
    // Trigger orchestration in background
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Post('anonymous')
  async createMediaAnonymous(@Body() dto: any) {
    const media = await this.mediaService.createMedia(dto);
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Get(':id')
  async getMedia(@Param('id') id: string, @Query('expiresIn') expiresIn?: string) {
    const options =
      expiresIn != null
        ? { expiresIn: Math.min(86400, Math.max(60, parseInt(expiresIn, 10) || 3600)) }
        : undefined;
    return await this.mediaService.getMedia(id, options);
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  async getUserMedia(@Request() req: any) {
    return await this.mediaService.getUserMedia(req.user.userId);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retryMedia(@Param('id') id: string) {
    const media = await this.mediaService.retryMedia(id);
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateMedia(@Param('id') id: string, @Body() dto: any) {
    return await this.mediaService.updateMedia(id, dto);
  }
}
