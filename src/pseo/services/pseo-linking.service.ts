import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PseoPage, PseoPlaybook, PseoPageStatus } from '../entities/pseo-page.entity';

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  india: 'hindi',
  brazil: 'portuguese',
  indonesia: 'indonesian',
  'united-states': 'english',
  'united-kingdom': 'english',
  australia: 'english',
  canada: 'english',
  nigeria: 'english',
  'south-africa': 'english',
  philippines: 'english',
};

const ALWAYS_LINKED = ['/glossary', '/features', '/blog'];

@Injectable()
export class PseoLinkingService {
  private readonly logger = new Logger(PseoLinkingService.name);

  constructor(
    @InjectRepository(PseoPage)
    private readonly repo: Repository<PseoPage>,
  ) {}

  async computeLinks(page: PseoPage): Promise<string[]> {
    const links = new Set<string>(ALWAYS_LINKED);

    const niche = page.seed_params?.niche;
    const persona = page.seed_params?.persona;
    const country = page.seed_params?.country;
    const language = page.seed_params?.language;

    // Same-niche siblings across different playbooks
    if (niche) {
      const nichePages = await this.repo.find({
        where: { status: PseoPageStatus.PUBLISHED },
        select: ['canonical_path', 'playbook', 'seed_params'],
      });

      for (const sibling of nichePages) {
        if (
          sibling.seed_params?.niche === niche &&
          sibling.playbook !== page.playbook &&
          sibling.canonical_path !== page.canonical_path
        ) {
          links.add(sibling.canonical_path);
        }
        if (links.size >= 10) break;
      }
    }

    // Personas → link to niche templates + comparisons
    if (persona) {
      const personaRelated = await this.repo
        .createQueryBuilder('p')
        .where('p.status = :status', { status: PseoPageStatus.PUBLISHED })
        .andWhere(`p.seed_params @> :params`, { params: JSON.stringify({ persona }) })
        .andWhere('p.id != :id', { id: page.id })
        .select(['p.canonical_path'])
        .take(4)
        .getMany();

      for (const r of personaRelated) {
        links.add(r.canonical_path);
      }
    }

    // Country → Language cross-link
    if (country) {
      const lang = COUNTRY_LANGUAGE_MAP[country];
      if (lang) {
        const langPage = await this.repo.findOne({
          where: { status: PseoPageStatus.PUBLISHED, playbook: PseoPlaybook.TRANSLATIONS },
          select: ['canonical_path'],
        });
        if (langPage) links.add(langPage.canonical_path);
      }
    }

    if (language) {
      // Language → Country cross-link
      const matchingCountry = Object.entries(COUNTRY_LANGUAGE_MAP).find(
        ([, l]) => l === language,
      )?.[0];
      if (matchingCountry) {
        const countryPage = await this.repo.findOne({
          where: { status: PseoPageStatus.PUBLISHED, playbook: PseoPlaybook.LOCATIONS },
          select: ['canonical_path'],
        });
        if (countryPage) links.add(countryPage.canonical_path);
      }
    }

    // Comparisons always link to /features
    if (page.playbook === PseoPlaybook.COMPARISONS) {
      links.add('/features');
    }

    // Remove self
    links.delete(page.canonical_path);

    const result = Array.from(links).slice(0, 8);
    this.logger.debug(`Computed ${result.length} links for ${page.slug}`);
    return result;
  }

  async updateReverseLinks(page: PseoPage, newLinks: string[]): Promise<void> {
    for (const path of newLinks) {
      const sibling = await this.repo.findOne({
        where: { canonical_path: path, status: PseoPageStatus.PUBLISHED },
      });
      if (!sibling) continue;

      const reverseSet = new Set(sibling.related_paths || []);
      reverseSet.add(page.canonical_path);
      if (reverseSet.size > 8) {
        const arr = Array.from(reverseSet);
        arr.shift();
        sibling.related_paths = arr;
      } else {
        sibling.related_paths = Array.from(reverseSet);
      }
      await this.repo.save(sibling);
    }
  }
}
