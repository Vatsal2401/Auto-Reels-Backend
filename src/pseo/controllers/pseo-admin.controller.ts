import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../admin/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../admin/guards/admin-role.guard';
import { PseoService } from '../services/pseo.service';
import { PseoSeedService } from '../services/pseo-seed.service';
import { PseoQueueService } from '../pseo-queue.service';
import { PseoPageStatus } from '../entities/pseo-page.entity';
import { SEED_DIMENSIONS } from '../config/seed-dimensions';
import {
  SeedPlaybookDto,
  GeneratePlaybookDto,
  PublishBatchDto,
  ComputeLinksDto,
  UpdateContentDto,
  ListPseoDto,
} from '../dto/seed-batch.dto';

@Controller('admin/pseo')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
export class PseoAdminController {
  constructor(
    private readonly pseoService: PseoService,
    private readonly pseoSeedService: PseoSeedService,
    private readonly pseoQueueService: PseoQueueService,
  ) {}

  /**
   * GET /admin/pseo?playbook=&status=&page=&limit=
   */
  @Get()
  async list(@Query() dto: ListPseoDto) {
    return this.pseoService.list(dto);
  }

  /**
   * GET /admin/pseo/stats
   */
  @Get('stats')
  async stats() {
    return this.pseoService.getStats();
  }

  /**
   * GET /admin/pseo/seed-dimensions
   * Returns current seed dimension arrays for each dimension type.
   */
  @Get('seed-dimensions')
  getSeedDimensions() {
    return SEED_DIMENSIONS;
  }

  /**
   * POST /admin/pseo/seed
   */
  @Post('seed')
  async seed(@Body() dto: SeedPlaybookDto) {
    return this.pseoSeedService.seedPlaybook(dto.playbook, dto.overwrite);
  }

  /**
   * POST /admin/pseo/generate
   * Enqueue generation jobs for up to `limit` draft pages in a playbook.
   */
  @Post('generate')
  async generate(@Body() dto: GeneratePlaybookDto) {
    const { pages } = await this.pseoService.list({
      playbook: dto.playbook,
      status: PseoPageStatus.DRAFT,
      page: 1,
      limit: dto.limit,
    });

    const enqueued = await this.pseoQueueService.addManyGenerateJobs(pages.map((p) => p.id));
    return { enqueued, playbook: dto.playbook };
  }

  /**
   * POST /admin/pseo/:id/publish
   */
  @Post(':id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    const page = await this.pseoService.publishPage(id);
    await this.pseoQueueService.addLinkJob(page.id);
    return page;
  }

  /**
   * POST /admin/pseo/publish-batch
   */
  @Post('publish-batch')
  async publishBatch(@Body() dto: PublishBatchDto) {
    const count = await this.pseoService.bulkPublish(dto.playbook, dto.minScore);
    return { published: count };
  }

  /**
   * POST /admin/pseo/compute-links
   */
  @Post('compute-links')
  async computeLinks(@Body() dto: ComputeLinksDto) {
    const { pages } = await this.pseoService.list({
      playbook: dto.playbook,
      status: PseoPageStatus.PUBLISHED,
      page: 1,
      limit: 10000,
    });

    const enqueued = await this.pseoQueueService.addManyGenerateJobs(pages.map((p) => p.id));
    return { enqueued };
  }

  /**
   * PATCH /admin/pseo/:id/content
   */
  @Patch(':id/content')
  async updateContent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContentDto) {
    const page = await this.pseoService.updateContent(id, dto.content);
    await this.pseoQueueService.addValidateJob(id);
    return page;
  }
}
