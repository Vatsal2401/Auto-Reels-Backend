import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { PseoService } from '../services/pseo.service';
import { PseoPlaybook } from '../entities/pseo-page.entity';

@Controller('pseo')
export class PseoPublicController {
  constructor(private readonly pseoService: PseoService) {}

  /**
   * Fetch a single published pSEO page by its canonical path.
   * Used by Next.js pages at render time (ISR).
   * GET /pseo/page?path=/tools/finance-reel-templates
   */
  @Get('page')
  async getPage(@Query('path') path: string) {
    if (!path) throw new NotFoundException('path query param required');
    const page = await this.pseoService.findByPath(path);
    if (!page) throw new NotFoundException(`No published page at ${path}`);
    return page;
  }

  /**
   * Return published page counts per playbook — used by sitemap index (no auth needed).
   * GET /pseo/published-counts
   */
  @Get('published-counts')
  async getPublishedCounts() {
    return this.pseoService.getPublishedCounts();
  }

  /**
   * Return canonical paths + published_at for sitemap generation.
   * Paginated 1000 per call.
   * GET /pseo/sitemap?playbook=templates&page=1&limit=1000
   */
  @Get('sitemap')
  async getSitemap(
    @Query('playbook') playbook: string,
    @Query('page') page = '1',
    @Query('limit') limit = '1000',
  ) {
    if (!playbook || !Object.values(PseoPlaybook).includes(playbook as PseoPlaybook)) {
      throw new NotFoundException(`Invalid playbook: ${playbook}`);
    }
    return this.pseoService.getSitemapEntries(
      playbook as PseoPlaybook,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 1000),
    );
  }
}
