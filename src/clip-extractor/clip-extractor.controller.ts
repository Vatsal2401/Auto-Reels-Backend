import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClipExtractorEnabledGuard } from './guards/clip-extractor-enabled.guard';
import { ClipExtractorService } from './services/clip-extractor.service';
import { CreateClipExtractJobDto } from './dto/create-clip-extract-job.dto';
import { S3StorageProvider } from '../storage/providers/s3-storage.provider';

// 7 days expiry for CloudFront/S3 signed URLs
const CLIP_URL_EXPIRY_SEC = 7 * 24 * 60 * 60;

@ApiTags('clip-extractor')
@ApiBearerAuth()
@Controller('clip-extractor')
@UseGuards(JwtAuthGuard, ClipExtractorEnabledGuard)
export class ClipExtractorController {
  constructor(
    private readonly clipExtractorService: ClipExtractorService,
    @Inject('IStorageService') private readonly storage: S3StorageProvider,
  ) {}

  @ApiOperation({ summary: 'Create a new clip extraction job from a YouTube/TikTok URL' })
  @Post('create')
  async create(@Body() dto: CreateClipExtractJobDto, @Request() req: any) {
    const isPremium = req.user?.isPremium ?? false;
    return this.clipExtractorService.createJob(dto, req.user.userId, isPremium);
  }

  @ApiOperation({ summary: 'List all clip extraction jobs for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('jobs')
  async listJobs(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.clipExtractorService.listJobs(req.user.userId, page, Math.min(limit, 50));
  }

  @ApiOperation({ summary: 'Get a specific clip extraction job with its clips' })
  @Get('jobs/:id')
  async getJob(@Param('id') id: string, @Request() req: any) {
    return this.clipExtractorService.getJob(id, req.user.userId);
  }

  @ApiOperation({ summary: 'List extracted clips for a job' })
  @Get('jobs/:id/clips')
  async listClips(@Param('id') id: string, @Request() req: any) {
    return this.clipExtractorService.getClips(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Get a signed CloudFront/S3 URL for a rendered clip' })
  @Get('clips/:clipId/url')
  async getClipUrl(@Param('clipId') clipId: string, @Request() req: any) {
    const clip = await this.clipExtractorService.getClipById(clipId, req.user.userId);

    if (!clip.rendered_clip_s3_key) {
      return { url: null, expiresAt: null };
    }

    const url = await this.storage.getSignedUrl(clip.rendered_clip_s3_key, CLIP_URL_EXPIRY_SEC);
    const expiresAt = new Date(Date.now() + CLIP_URL_EXPIRY_SEC * 1000).toISOString();

    return { url, expiresAt };
  }

  @ApiOperation({ summary: 'Get a signed CloudFront/S3 URL for a clip thumbnail' })
  @Get('clips/:clipId/thumb-url')
  async getClipThumbUrl(@Param('clipId') clipId: string, @Request() req: any) {
    const clip = await this.clipExtractorService.getClipById(clipId, req.user.userId);

    if (!clip.thumbnail_s3_key) {
      return { url: null };
    }

    const url = await this.storage.getSignedUrl(clip.thumbnail_s3_key, CLIP_URL_EXPIRY_SEC);
    return { url };
  }

  @ApiOperation({ summary: 'Delete a clip extraction job and refund credits if applicable' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('jobs/:id')
  async deleteJob(@Param('id') id: string, @Request() req: any): Promise<void> {
    await this.clipExtractorService.deleteJob(id, req.user.userId);
  }
}
