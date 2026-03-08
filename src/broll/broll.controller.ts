import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrollService } from './broll.service';
import { MatchScriptDto } from './dto/match-script.dto';

@ApiTags('broll')
@ApiBearerAuth()
@Controller('broll')
@UseGuards(JwtAuthGuard)
export class BrollController {
  constructor(private readonly brollService: BrollService) {}

  @Post('videos/presign')
  @ApiOperation({ summary: 'Get a presigned S3 PUT URL to upload a B-roll video directly from the browser' })
  async presignUpload(
    @Req() req: any,
    @Body() body: { filename: string; contentType?: string },
  ) {
    if (!body.filename) throw new BadRequestException('filename is required');
    return this.brollService.presignUpload(req.user?.userId ?? req.user?.id, body.filename, body.contentType);
  }

  @Post('videos/ingest')
  @ApiOperation({ summary: 'Trigger CLIP ingestion for an already-uploaded S3 video' })
  async ingestVideo(@Body() body: { s3Key: string; filename: string }) {
    if (!body.s3Key || !body.filename) throw new BadRequestException('s3Key and filename are required');
    return this.brollService.ingestVideo(body.s3Key, body.filename);
  }

  @Post('match')
  @ApiOperation({ summary: 'Match script lines to B-roll clips via CLIP embeddings' })
  async matchScript(@Body() dto: MatchScriptDto) {
    return this.brollService.matchScript(dto);
  }

  @Get('ingest/status')
  @ApiOperation({ summary: 'Get B-roll ingestion pipeline status' })
  async getIngestionStatus() {
    return this.brollService.getIngestionStatus();
  }

  @Get('videos')
  @ApiOperation({ summary: 'List all B-roll videos and their ingestion status' })
  async listVideos() {
    return this.brollService.listVideos();
  }
}
