import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BrollEnabledGuard } from '../guards/broll-enabled.guard';
import { BrollLibraryService } from '../services/broll-library.service';
import { BrollAirImportService } from '../services/broll-air-import.service';
import { CreateLibraryDto } from '../dto/create-library.dto';
import { UpdateLibraryDto } from '../dto/update-library.dto';
import { ImportFromAirDto } from '../dto/import-from-air.dto';
import { BrowseAirDto } from '../dto/browse-air.dto';

@ApiTags('broll/libraries')
@ApiBearerAuth()
@Controller('broll/libraries')
@UseGuards(JwtAuthGuard, BrollEnabledGuard)
export class BrollLibraryController {
  constructor(
    private readonly libraryService: BrollLibraryService,
    private readonly airImportService: BrollAirImportService,
  ) {}

  private userId(req: { user?: { userId?: string; id?: string } }): string {
    return req.user?.userId ?? req.user?.id ?? '';
  }

  @Post()
  @ApiOperation({ summary: 'Create a new B-roll library' })
  async create(@Req() req: { user?: { userId?: string; id?: string } }, @Body() dto: CreateLibraryDto) {
    return this.libraryService.createLibrary(this.userId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user B-roll libraries' })
  async list(@Req() req: { user?: { userId?: string; id?: string } }) {
    return this.libraryService.listLibraries(this.userId(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a library with stats' })
  async getOne(@Req() req: { user?: { userId?: string; id?: string } }, @Param('id') id: string) {
    return this.libraryService.getLibrary(id, this.userId(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update library name/description' })
  async update(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateLibraryDto,
  ) {
    await this.libraryService.updateLibrary(id, this.userId(req), dto);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete library and all its videos and scripts' })
  async delete(@Req() req: { user?: { userId?: string; id?: string } }, @Param('id') id: string) {
    await this.libraryService.deleteLibrary(id, this.userId(req));
    return { success: true };
  }

  @Post(':id/videos/presign')
  @ApiOperation({ summary: 'Get presigned S3 PUT URL to upload a video to the library (files < 100 MB)' })
  async presignUpload(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: { filename: string; contentType?: string },
  ) {
    if (!body.filename) throw new BadRequestException('filename is required');
    return this.libraryService.presignUpload(id, this.userId(req), body.filename, body.contentType);
  }

  @Post(':id/videos/presign-multipart')
  @ApiOperation({ summary: 'Initiate S3 multipart upload (files ≥ 100 MB)' })
  async presignMultipart(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: { filename: string; contentType: string; size: number },
  ) {
    if (!body.filename) throw new BadRequestException('filename is required');
    if (!body.contentType) throw new BadRequestException('contentType is required');
    if (!body.size || body.size <= 0) throw new BadRequestException('size must be > 0');
    return this.libraryService.presignMultipart(
      id,
      this.userId(req),
      body.filename,
      body.contentType,
      body.size,
    );
  }

  @Post(':id/videos/presign-parts')
  @ApiOperation({ summary: 'Presign URLs for multipart upload parts' })
  async presignParts(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: { videoId: string; uploadId: string; key: string; partNumbers: number[] },
  ) {
    if (!body.uploadId || !body.key || !body.partNumbers?.length) {
      throw new BadRequestException('uploadId, key, and partNumbers are required');
    }
    return this.libraryService.presignParts(
      id,
      this.userId(req),
      body.videoId,
      body.uploadId,
      body.key,
      body.partNumbers,
    );
  }

  @Post(':id/videos/complete-multipart')
  @ApiOperation({ summary: 'Complete a multipart upload after all parts are uploaded' })
  async completeMultipart(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: {
      videoId: string;
      uploadId: string;
      key: string;
      parts: { partNumber: number; etag: string }[];
    },
  ) {
    if (!body.uploadId || !body.key || !body.parts?.length) {
      throw new BadRequestException('uploadId, key, and parts are required');
    }
    return this.libraryService.completeMultipart(
      id,
      this.userId(req),
      body.videoId,
      body.uploadId,
      body.key,
      body.parts,
    );
  }

  @Delete(':id/videos/abort-multipart')
  @ApiOperation({ summary: 'Abort a multipart upload and remove the video row' })
  async abortMultipart(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: { videoId: string; uploadId: string; key: string },
  ) {
    if (!body.uploadId || !body.key) {
      throw new BadRequestException('uploadId and key are required');
    }
    await this.libraryService.abortMultipart(
      id,
      this.userId(req),
      body.videoId,
      body.uploadId,
      body.key,
    );
    return { success: true };
  }

  @Post(':id/search')
  @ApiOperation({ summary: 'Search indexed clips by text query (for clip picker)' })
  async searchClips(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() body: { query: string; topK?: number },
  ): Promise<unknown[]> {
    if (!body.query?.trim()) throw new BadRequestException('query is required');
    return this.libraryService.searchClips(id, this.userId(req), body.query.trim(), body.topK ?? 10);
  }

  @Post(':id/videos/:videoId/confirm')
  @ApiOperation({ summary: 'Confirm that a single-part S3 PUT upload has completed' })
  async confirmUpload(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    await this.libraryService.confirmUpload(id, videoId, this.userId(req));
    return { success: true };
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'List videos in the library with ingestion job status' })
  async listVideos(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
  ): Promise<unknown[]> {
    return this.libraryService.listVideos(id, this.userId(req));
  }

  @Delete(':id/videos/:videoId')
  @ApiOperation({ summary: 'Remove a video from the library' })
  async deleteVideo(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    await this.libraryService.deleteVideo(id, videoId, this.userId(req));
    return { success: true };
  }

  @Post(':id/index')
  @ApiOperation({ summary: 'Bulk index all unindexed videos in the library' })
  async indexAll(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
  ) {
    return this.libraryService.indexAll(id, this.userId(req));
  }

  @Post(':id/videos/:videoId/index')
  @ApiOperation({ summary: 'Index a single video' })
  async indexOne(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    await this.libraryService.indexOne(id, videoId, this.userId(req));
    return { success: true };
  }

  @Post(':id/videos/:videoId/reindex')
  @ApiOperation({ summary: 'Force re-index a video' })
  async reindexOne(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    await this.libraryService.reindexOne(id, videoId, this.userId(req));
    return { success: true };
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'List ingestion jobs for the library (for polling)' })
  async listJobs(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
  ) {
    return this.libraryService.listJobs(id, this.userId(req));
  }

  @Get(':id/videos/:videoId/preview')
  @ApiOperation({ summary: 'Get signed URL to preview a video' })
  async getPreview(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.libraryService.getVideoPreviewUrl(id, videoId, this.userId(req));
  }

  @Get(':id/videos/:videoId/frames')
  @ApiOperation({ summary: 'Get frame timeline with semantic captions for an indexed video' })
  async getVideoFrames(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.libraryService.getVideoFrames(id, videoId, this.userId(req));
  }

  @Post(':id/import/air/browse')
  @ApiOperation({ summary: 'Browse clips from a public AIR share link' })
  async browseAirBoard(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() dto: BrowseAirDto,
  ) {
    return this.airImportService.browseBoard(id, this.userId(req), dto);
  }

  @Post(':id/import/air')
  @ApiOperation({ summary: 'Start a server-side AIR board → S3 import job' })
  async importFromAir(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
    @Body() dto: ImportFromAirDto,
  ) {
    return this.airImportService.startImport(id, this.userId(req), dto);
  }

  @Get(':id/import-jobs')
  @ApiOperation({ summary: 'List AIR import jobs for a library' })
  async listImportJobs(
    @Req() req: { user?: { userId?: string; id?: string } },
    @Param('id') id: string,
  ) {
    return this.airImportService.listImports(id, this.userId(req));
  }
}
