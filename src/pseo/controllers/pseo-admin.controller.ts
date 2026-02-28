import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminJwtGuard } from '../../admin/guards/admin-jwt.guard';
import { AdminRoleGuard } from '../../admin/guards/admin-role.guard';
import { PseoService } from '../services/pseo.service';
import { PseoSeedService } from '../services/pseo-seed.service';
import { PseoQueueService } from '../pseo-queue.service';
import { PseoPageStatus } from '../entities/pseo-page.entity';
import { PseoSeedDimension } from '../entities/pseo-seed-dimension.entity';
import { PseoPlaybookConfig } from '../entities/pseo-playbook-config.entity';
import {
  SeedPlaybookDto,
  GeneratePlaybookDto,
  PublishBatchDto,
  ComputeLinksDto,
  UpdateContentDto,
  UpdateMetadataDto,
  UpdateDimensionDto,
  AddDimensionValueDto,
  UpdatePlaybookConfigDto,
  ListPseoDto,
} from '../dto/seed-batch.dto';

@Controller('admin/pseo')
@UseGuards(AdminJwtGuard, AdminRoleGuard)
export class PseoAdminController {
  constructor(
    private readonly pseoService: PseoService,
    private readonly pseoSeedService: PseoSeedService,
    private readonly pseoQueueService: PseoQueueService,
    @InjectRepository(PseoSeedDimension)
    private readonly dimensionsRepo: Repository<PseoSeedDimension>,
    @InjectRepository(PseoPlaybookConfig)
    private readonly configsRepo: Repository<PseoPlaybookConfig>,
  ) {}

  // ─── Pages list & stats ───────────────────────────────────────────────────

  /**
   * GET /admin/pseo?playbook=&status=&search=&page=&limit=
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

  // ─── Dimensions CRUD ──────────────────────────────────────────────────────

  /**
   * GET /admin/pseo/dimensions
   * Returns all dimension groups with their current values from DB.
   */
  @Get('dimensions')
  async getDimensions() {
    return this.dimensionsRepo.find({ order: { name: 'ASC' } });
  }

  /**
   * PATCH /admin/pseo/dimensions/:name
   * Replace the entire values array for a dimension.
   */
  @Patch('dimensions/:name')
  async updateDimension(@Param('name') name: string, @Body() dto: UpdateDimensionDto) {
    const dim = await this.dimensionsRepo.findOne({ where: { name } });
    if (!dim) throw new NotFoundException(`Dimension '${name}' not found`);
    dim.values = dto.values;
    return this.dimensionsRepo.save(dim);
  }

  /**
   * POST /admin/pseo/dimensions/:name/add
   * Add a single value to a dimension (idempotent).
   */
  @Post('dimensions/:name/add')
  async addDimensionValue(@Param('name') name: string, @Body() dto: AddDimensionValueDto) {
    const dim = await this.dimensionsRepo.findOne({ where: { name } });
    if (!dim) throw new NotFoundException(`Dimension '${name}' not found`);
    const value = dto.value.trim().toLowerCase();
    if (!dim.values.includes(value)) {
      dim.values = [...dim.values, value];
      return this.dimensionsRepo.save(dim);
    }
    return dim;
  }

  /**
   * DELETE /admin/pseo/dimensions/:name/:value
   * Remove a single value from a dimension.
   */
  @Delete('dimensions/:name/:value')
  async removeDimensionValue(@Param('name') name: string, @Param('value') value: string) {
    const dim = await this.dimensionsRepo.findOne({ where: { name } });
    if (!dim) throw new NotFoundException(`Dimension '${name}' not found`);
    dim.values = dim.values.filter((v) => v !== decodeURIComponent(value));
    return this.dimensionsRepo.save(dim);
  }

  // ─── Playbook config CRUD ─────────────────────────────────────────────────

  /**
   * GET /admin/pseo/playbook-configs
   */
  @Get('playbook-configs')
  async getPlaybookConfigs() {
    return this.configsRepo.find({ order: { playbook: 'ASC' } });
  }

  /**
   * PATCH /admin/pseo/playbook-configs/:playbook
   */
  @Patch('playbook-configs/:playbook')
  async updatePlaybookConfig(
    @Param('playbook') playbook: string,
    @Body() dto: UpdatePlaybookConfigDto,
  ) {
    const config = await this.configsRepo.findOne({ where: { playbook } });
    if (!config) throw new NotFoundException(`Playbook config '${playbook}' not found`);
    if (dto.enabled !== undefined) config.enabled = dto.enabled;
    if (dto.min_quality_score !== undefined) config.min_quality_score = dto.min_quality_score;
    if (dto.min_word_count !== undefined) config.min_word_count = dto.min_word_count;
    return this.configsRepo.save(config);
  }

  // ─── Seed / generate / publish ────────────────────────────────────────────

  /**
   * GET /admin/pseo/seed-dimensions
   * Returns seed dimensions as a flat record (backwards compatible).
   */
  @Get('seed-dimensions')
  async getSeedDimensions() {
    const dims = await this.dimensionsRepo.find();
    const flat: Record<string, string[]> = {};
    for (const d of dims) flat[d.name] = d.values;
    return flat;
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

  // ─── Per-page operations ──────────────────────────────────────────────────

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
   * POST /admin/pseo/:id/unpublish
   */
  @Post(':id/unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.pseoService.unpublishPage(id);
  }

  /**
   * PATCH /admin/pseo/:id/metadata
   */
  @Patch(':id/metadata')
  async updateMetadata(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMetadataDto) {
    return this.pseoService.updateMetadata(id, dto);
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

  /**
   * DELETE /admin/pseo/:id
   * Soft delete — sets status to ARCHIVED.
   */
  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.pseoService.archivePage(id);
  }
}
