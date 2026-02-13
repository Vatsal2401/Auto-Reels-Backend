import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Patch,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
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
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Post('anonymous')
  async createMediaAnonymous(@Body() dto: any) {
    const media = await this.mediaService.createMedia(dto);
    this.orchestratorService.processMedia(media.id);
    return media;
  }

  @Get('user/me/list')
  @UseGuards(JwtAuthGuard)
  async getUserMediaPaginated(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limitNum = limit ? Math.min(50, Math.max(1, parseInt(limit, 10) || 20)) : 20;
    return await this.mediaService.getUserMediaPaginated(
      req.user.userId,
      limitNum,
      cursor || undefined,
    );
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  async getUserMedia(@Request() req: any) {
    return await this.mediaService.getUserMedia(req.user.userId);
  }

  @Get(':id/editor')
  async getEditorPayload(@Param('id') id: string) {
    return await this.mediaService.getEditorPayload(id);
  }

  @Get(':id')
  async getMedia(@Param('id') id: string) {
    return await this.mediaService.getMedia(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMedia(@Param('id') id: string, @Request() req: any) {
    await this.mediaService.deleteMedia(id, req.user.userId);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  async duplicateMedia(@Param('id') id: string, @Request() req: any) {
    return await this.mediaService.duplicateMedia(id, req.user.userId);
  }

  @Post(':id/export')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async exportAsVersion(@Param('id') id: string, @Request() req: any) {
    const media = await this.mediaService.exportAsVersion(id, req.user.userId);
    this.orchestratorService.processMedia(media.id);
    return media;
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

  @Post(':id/rerender')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rerenderMedia(
    @Param('id') id: string,
    @Body() body: { fromStep?: 'render' | 'script' },
    @Request() req: any,
  ) {
    const fromStep = body?.fromStep ?? 'render';
    const media = await this.mediaService.rerenderMedia(id, req.user.userId, fromStep);
    this.orchestratorService.processMedia(media.id);
    return media;
  }
}
