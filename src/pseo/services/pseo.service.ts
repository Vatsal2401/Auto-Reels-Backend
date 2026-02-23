import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PseoPage, PseoPageStatus, PseoPlaybook } from '../entities/pseo-page.entity';
import { ListPseoDto } from '../dto/seed-batch.dto';

@Injectable()
export class PseoService {
  private readonly logger = new Logger(PseoService.name);

  constructor(
    @InjectRepository(PseoPage)
    private readonly repo: Repository<PseoPage>,
    private readonly configService: ConfigService,
  ) {}

  async findByPath(canonicalPath: string): Promise<PseoPage | null> {
    return this.repo.findOne({
      where: { canonical_path: canonicalPath, status: PseoPageStatus.PUBLISHED },
    });
  }

  async findById(id: string): Promise<PseoPage> {
    const page = await this.repo.findOne({ where: { id } });
    if (!page) throw new NotFoundException(`PseoPage ${id} not found`);
    return page;
  }

  async list(dto: ListPseoDto): Promise<{ pages: PseoPage[]; total: number }> {
    const page = dto.page || 1;
    const limit = dto.limit || 50;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('p')
      .skip(skip)
      .take(limit)
      .orderBy('p.created_at', 'DESC');
    if (dto.playbook) qb.andWhere('p.playbook = :playbook', { playbook: dto.playbook });
    if (dto.status) qb.andWhere('p.status = :status', { status: dto.status });

    const [pages, total] = await qb.getManyAndCount();
    return { pages, total };
  }

  async getSitemapEntries(
    playbook: PseoPlaybook,
    page: number,
    limit: number,
  ): Promise<{ pages: Pick<PseoPage, 'canonical_path' | 'published_at'>[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.repo.findAndCount({
      where: { playbook, status: PseoPageStatus.PUBLISHED },
      select: ['canonical_path', 'published_at'],
      skip,
      take: limit,
      order: { published_at: 'DESC' },
    });
    return { pages: rows, total };
  }

  async getStats(): Promise<Record<string, Record<string, number>>> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('p.playbook', 'playbook')
      .addSelect('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.playbook')
      .addGroupBy('p.status')
      .getRawMany();

    const stats: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!stats[row.playbook]) stats[row.playbook] = {};
      stats[row.playbook][row.status] = parseInt(row.count, 10);
    }
    return stats;
  }

  async updateContent(id: string, content: Record<string, any>): Promise<PseoPage> {
    const page = await this.findById(id);
    page.content = content;
    page.status = PseoPageStatus.GENERATED;
    return this.repo.save(page);
  }

  async publishPage(id: string): Promise<PseoPage> {
    const page = await this.findById(id);
    if (![PseoPageStatus.GENERATED, PseoPageStatus.VALIDATING].includes(page.status)) {
      throw new BadRequestException(
        `Page must be in generated or validating state to publish, got: ${page.status}`,
      );
    }
    page.status = PseoPageStatus.PUBLISHED;
    page.published_at = new Date();
    const saved = await this.repo.save(page);
    this.triggerIsrRevalidation(page.canonical_path);
    return saved;
  }

  async bulkPublish(playbook: PseoPlaybook | undefined, minScore: number): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PseoPageStatus.GENERATED })
      .andWhere('p.quality_score >= :minScore', { minScore });

    if (playbook) qb.andWhere('p.playbook = :playbook', { playbook });

    const pages = await qb.getMany();
    for (const p of pages) {
      p.status = PseoPageStatus.PUBLISHED;
      p.published_at = new Date();
    }
    await this.repo.save(pages);

    for (const p of pages) {
      this.triggerIsrRevalidation(p.canonical_path).catch((err) =>
        this.logger.warn(`ISR failed for ${p.canonical_path}: ${err.message}`),
      );
    }
    return pages.length;
  }

  private async triggerIsrRevalidation(canonicalPath: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const token = this.configService.get<string>('REVALIDATE_TOKEN') || '';

    try {
      await fetch(`${frontendUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-revalidate-token': token },
        body: JSON.stringify({ path: canonicalPath }),
        signal: AbortSignal.timeout(5000),
      });
      this.logger.log(`ISR revalidated: ${canonicalPath}`);
    } catch (err) {
      this.logger.warn(`ISR revalidation failed for ${canonicalPath}: ${err.message}`);
    }
  }
}
