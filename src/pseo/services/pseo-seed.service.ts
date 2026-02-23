import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PseoPage, PseoPlaybook, PseoPageStatus } from '../entities/pseo-page.entity';
import { PseoSeedDimension } from '../entities/pseo-seed-dimension.entity';

export interface SeedResult {
  created: number;
  skipped: number;
}

@Injectable()
export class PseoSeedService {
  private readonly logger = new Logger(PseoSeedService.name);

  /** 60-second in-memory cache for dimensions to avoid repeated DB reads during bulk seeding */
  private dimsCache: { data: Record<string, string[]>; expiry: number } | null = null;

  constructor(
    @InjectRepository(PseoPage)
    private readonly repo: Repository<PseoPage>,
    @InjectRepository(PseoSeedDimension)
    private readonly dimsRepo: Repository<PseoSeedDimension>,
  ) {}

  async seedPlaybook(playbook: PseoPlaybook, overwrite = false): Promise<SeedResult> {
    const dims = await this.getDimensions();
    const rows = this.buildRows(playbook, dims);
    this.logger.log(`Seeding ${playbook}: ${rows.length} rows`);

    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(PseoPage)
      .values(rows as any[])
      .orIgnore(!overwrite)
      .execute();

    const created = result.identifiers.length;
    const skipped = rows.length - created;
    this.logger.log(`Seeded ${playbook}: created=${created}, skipped=${skipped}`);
    return { created, skipped };
  }

  async getDimensions(): Promise<Record<string, string[]>> {
    const now = Date.now();
    if (this.dimsCache && this.dimsCache.expiry > now) {
      return this.dimsCache.data;
    }
    const rows = await this.dimsRepo.find();
    const data: Record<string, string[]> = {};
    for (const row of rows) data[row.name] = row.values;
    this.dimsCache = { data, expiry: now + 60_000 };
    return data;
  }

  private buildRows(playbook: PseoPlaybook, dims: Record<string, string[]>): Partial<PseoPage>[] {
    switch (playbook) {
      case PseoPlaybook.TEMPLATES:
        return this.buildTemplateRows(dims);
      case PseoPlaybook.CURATION:
        return this.buildCurationRows(dims);
      case PseoPlaybook.CONVERSIONS:
        return this.buildConversionRows(dims);
      case PseoPlaybook.COMPARISONS:
        return this.buildComparisonRows(dims);
      case PseoPlaybook.EXAMPLES:
        return this.buildExampleRows(dims);
      case PseoPlaybook.LOCATIONS:
        return this.buildLocationRows(dims);
      case PseoPlaybook.PERSONAS:
        return this.buildPersonaRows(dims);
      case PseoPlaybook.INTEGRATIONS:
        return this.buildIntegrationRows(dims);
      case PseoPlaybook.GLOSSARY:
        return this.buildGlossaryRows(dims);
      case PseoPlaybook.TRANSLATIONS:
        return this.buildTranslationRows(dims);
      case PseoPlaybook.DIRECTORY:
        return this.buildDirectoryRows(dims);
      case PseoPlaybook.PROFILES:
        return this.buildProfileRows(dims);
      default:
        return [];
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────
  private buildTemplateRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const niches = dims.niches ?? [];
    const platforms = dims.platforms ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const niche of niches) {
      const slug = `${niche}-reel-templates`;
      rows.push(
        this.makeRow(PseoPlaybook.TEMPLATES, slug, `/tools/${slug}`, {
          title: `${this.capitalize(niche)} Reel Templates — Free AI Reel Templates`,
          meta_description: `Browse free AI-generated ${niche} reel templates. Ready-to-use hooks, scripts, and visuals for faceless ${niche} reels.`,
          keywords: [
            `${niche} reel templates`,
            'faceless reel templates',
            'AI reel templates',
            niche,
          ],
          seed_params: { niche },
        }),
      );
      for (const platform of platforms) {
        const s2 = `${niche}-${platform}-reel-templates`;
        rows.push(
          this.makeRow(PseoPlaybook.TEMPLATES, s2, `/tools/${s2}`, {
            title: `${this.capitalize(niche)} ${this.capitalize(platform)} Reel Templates`,
            meta_description: `Free AI ${niche} reel templates optimized for ${platform}. Get hooks, scripts and visuals in one click.`,
            keywords: [
              `${niche} ${platform} templates`,
              `${platform} reel templates`,
              niche,
              platform,
            ],
            seed_params: { niche, platform },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Curation ─────────────────────────────────────────────────────────────
  private buildCurationRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const niches = dims.niches ?? [];
    const tones = dims.tones ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const niche of niches) {
      const slug = `${niche}-reel-ideas`;
      rows.push(
        this.makeRow(PseoPlaybook.CURATION, slug, `/ideas/${slug}`, {
          title: `${this.capitalize(niche)} Reel Ideas — 50+ AI Content Ideas`,
          meta_description: `Discover 50+ proven ${niche} reel ideas. AI-curated content ideas for faceless creators posting about ${niche}.`,
          keywords: [`${niche} reel ideas`, 'reel content ideas', 'faceless reel ideas', niche],
          seed_params: { niche },
        }),
      );
      for (const tone of tones) {
        const s2 = `${niche}-${tone}-reel-ideas`;
        rows.push(
          this.makeRow(PseoPlaybook.CURATION, s2, `/ideas/${s2}`, {
            title: `${this.capitalize(tone)} ${this.capitalize(niche)} Reel Ideas`,
            meta_description: `${this.capitalize(tone)} ${niche} reel content ideas crafted by AI. Perfect for faceless creators.`,
            keywords: [`${tone} ${niche} reel ideas`, `${niche} ideas`, tone, niche],
            seed_params: { niche, tone },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Conversions ──────────────────────────────────────────────────────────
  private buildConversionRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const plans = dims.plans ?? [];
    const personas = dims.personas ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const plan of plans) {
      const slug = `${plan}-plan`;
      rows.push(
        this.makeRow(PseoPlaybook.CONVERSIONS, slug, `/pricing/${slug}`, {
          title: `AutoReels ${this.capitalize(plan)} Plan — Pricing & Features`,
          meta_description: `Everything included in AutoReels ${plan} plan. Compare features, credits, and pricing to choose the right plan.`,
          keywords: [
            `autoreels ${plan} plan`,
            'autoreels pricing',
            `${plan} plan`,
            'AI video pricing',
          ],
          seed_params: { plan },
        }),
      );
      for (const persona of personas.slice(0, 4)) {
        const s2 = `${plan}-plan-for-${persona}`;
        rows.push(
          this.makeRow(PseoPlaybook.CONVERSIONS, s2, `/pricing/${s2}`, {
            title: `AutoReels ${this.capitalize(plan)} Plan for ${this.capitalize(persona)}`,
            meta_description: `Why ${persona} choose AutoReels ${plan} plan. Features and pricing tailored for ${persona}.`,
            keywords: [
              `autoreels for ${persona}`,
              `${plan} plan`,
              persona,
              'AI reel generator pricing',
            ],
            seed_params: { plan, persona },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Comparisons ──────────────────────────────────────────────────────────
  private buildComparisonRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const competitors = dims.competitors ?? [];
    const personas = dims.personas ?? [];
    const rows: Partial<PseoPage>[] = [];
    rows.push(
      this.makeRow(PseoPlaybook.COMPARISONS, 'vs-index', '/vs', {
        title: 'AutoReels vs Competitors — Which AI Video Tool Wins?',
        meta_description:
          'Side-by-side comparisons of AutoReels vs top AI video creators. Features, pricing, and verdict for faceless video creators.',
        keywords: [
          'AI video comparison',
          'autoreels vs invideo',
          'autoreels vs canva',
          'best ai reel generator',
        ],
        seed_params: {},
      }),
    );
    for (const competitor of competitors) {
      const slug = `autoreels-vs-${competitor}`;
      rows.push(
        this.makeRow(PseoPlaybook.COMPARISONS, slug, `/vs/${slug}`, {
          title: `AutoReels vs ${this.capitalize(competitor)} — Which AI Video Tool Wins?`,
          meta_description: `Side-by-side comparison of AutoReels vs ${competitor}. Features, pricing, and verdict for faceless video creators.`,
          keywords: [
            `autoreels vs ${competitor}`,
            `${competitor} alternative`,
            'AI video comparison',
            competitor,
          ],
          seed_params: { competitor },
        }),
      );
      for (const persona of personas) {
        const s2 = `autoreels-vs-${competitor}-for-${persona}`;
        rows.push(
          this.makeRow(PseoPlaybook.COMPARISONS, s2, `/vs/${s2}`, {
            title: `AutoReels vs ${this.capitalize(competitor)} for ${this.capitalize(persona)}`,
            meta_description: `AutoReels vs ${competitor} compared specifically for ${persona}. See which tool fits your workflow.`,
            keywords: [`autoreels vs ${competitor}`, persona, competitor, 'AI video tool'],
            seed_params: { competitor, persona },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Examples ─────────────────────────────────────────────────────────────
  private buildExampleRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const niches = dims.niches ?? [];
    const tones = dims.tones ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const niche of niches) {
      const slug = `${niche}-reel-examples`;
      rows.push(
        this.makeRow(PseoPlaybook.EXAMPLES, slug, `/examples/${slug}`, {
          title: `${this.capitalize(niche)} Reel Examples — AI-Generated Reels`,
          meta_description: `See real ${niche} reel examples created with AutoReels AI. Scripts, hooks, and visuals included.`,
          keywords: [`${niche} reel examples`, 'faceless reel examples', niche, 'AI reel examples'],
          seed_params: { niche },
        }),
      );
      for (const tone of tones) {
        const s2 = `${niche}-${tone}-reel-examples`;
        rows.push(
          this.makeRow(PseoPlaybook.EXAMPLES, s2, `/examples/${s2}`, {
            title: `${this.capitalize(tone)} ${this.capitalize(niche)} Reel Examples`,
            meta_description: `${this.capitalize(tone)} style ${niche} reel examples. Swipe scripts and hooks that work on any platform.`,
            keywords: [`${tone} ${niche} reel examples`, niche, tone, 'AI reel'],
            seed_params: { niche, tone },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Locations ────────────────────────────────────────────────────────────
  private buildLocationRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const countries = dims.countries ?? [];
    const niches = dims.niches ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const country of countries) {
      rows.push(
        this.makeRow(
          PseoPlaybook.LOCATIONS,
          `${country}-ai-reel-generator`,
          `/${country}/ai-reel-generator`,
          {
            title: `AI Reel Generator in ${this.capitalize(country)} — AutoReels`,
            meta_description: `Create faceless reels from ${country} using AutoReels AI. Local pricing, top niches, and creator tips for ${country}.`,
            keywords: [
              `AI reel generator ${country}`,
              `faceless reel ${country}`,
              country,
              'AI video tool',
            ],
            seed_params: { country },
          },
        ),
      );
      for (const niche of niches) {
        const s2 = `${niche}-reel-creator`;
        rows.push(
          this.makeRow(PseoPlaybook.LOCATIONS, `${country}-${s2}`, `/${country}/${s2}`, {
            title: `${this.capitalize(niche)} Reel Creator in ${this.capitalize(country)}`,
            meta_description: `Top AI-powered ${niche} reel creator for creators in ${country}. Local hooks, pricing in local currency.`,
            keywords: [`${niche} reel creator ${country}`, country, niche, 'faceless reel'],
            seed_params: { country, niche },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Personas ─────────────────────────────────────────────────────────────
  private buildPersonaRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const personas = dims.personas ?? [];
    const niches = dims.niches ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const persona of personas) {
      rows.push(
        this.makeRow(PseoPlaybook.PERSONAS, `for-${persona}`, `/for/${persona}`, {
          title: `AutoReels for ${this.capitalize(persona)} — AI Reel Generator`,
          meta_description: `AutoReels helps ${persona} create viral faceless reels without filming. AI scripts, voiceovers, and visuals in 60 seconds.`,
          keywords: [
            `autoreels for ${persona}`,
            `${persona} content creation`,
            'faceless reel',
            persona,
          ],
          seed_params: { persona },
        }),
      );
      for (const niche of niches) {
        const s2 = `for-${persona}-${niche}-reels`;
        rows.push(
          this.makeRow(PseoPlaybook.PERSONAS, s2, `/for/${persona}/${niche}-reels`, {
            title: `${this.capitalize(niche)} Reels for ${this.capitalize(persona)}`,
            meta_description: `Create ${niche} reels as a ${persona.replace(/-/g, ' ')} using AutoReels AI. No editing or filming required.`,
            keywords: [`${niche} reels for ${persona}`, persona, niche, 'AI reel generator'],
            seed_params: { persona, niche },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Integrations ─────────────────────────────────────────────────────────
  private buildIntegrationRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const integrations = dims.integrations ?? [];
    const useCases = [
      'content-scheduling',
      'auto-publish',
      'workflow-automation',
      'team-collaboration',
      'analytics-tracking',
    ];
    const rows: Partial<PseoPage>[] = [];
    for (const integration of integrations) {
      rows.push(
        this.makeRow(
          PseoPlaybook.INTEGRATIONS,
          `integration-${integration}`,
          `/integrations/${integration}`,
          {
            title: `AutoReels + ${this.capitalize(integration)} Integration`,
            meta_description: `Connect AutoReels with ${integration}. Auto-publish AI reels, schedule content, and streamline your workflow.`,
            keywords: [
              `autoreels ${integration} integration`,
              integration,
              'AI video integration',
              'reel automation',
            ],
            seed_params: { integration },
          },
        ),
      );
      for (const useCase of useCases) {
        const s2 = `integration-${integration}-${useCase}`;
        rows.push(
          this.makeRow(PseoPlaybook.INTEGRATIONS, s2, `/integrations/${integration}/${useCase}`, {
            title: `AutoReels + ${this.capitalize(integration)}: ${this.capitalize(useCase)}`,
            meta_description: `Use AutoReels with ${integration} for ${useCase.replace(/-/g, ' ')}. Step-by-step setup guide and automation tips.`,
            keywords: [
              `${integration} ${useCase}`,
              integration,
              useCase.replace(/-/g, ' '),
              'reel automation',
            ],
            seed_params: { integration, use_case: useCase },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Glossary ─────────────────────────────────────────────────────────────
  private buildGlossaryRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const glossaryTerms = dims.glossary_terms ?? [];
    const rows: Partial<PseoPage>[] = [];
    rows.push(
      this.makeRow(PseoPlaybook.GLOSSARY, 'glossary-index', '/glossary', {
        title: 'AI Video & Faceless Reel Glossary',
        meta_description:
          'Complete glossary of AI video creation, faceless reel, and social media terms. Learn the language of viral content.',
        keywords: [
          'AI video glossary',
          'faceless reel terms',
          'video creation glossary',
          'reel terms',
        ],
        seed_params: {},
      }),
    );
    for (const term of glossaryTerms) {
      rows.push(
        this.makeRow(PseoPlaybook.GLOSSARY, `glossary-${term}`, `/glossary/${term}`, {
          title: `${this.capitalize(term)} — AI Video Glossary`,
          meta_description: `What is ${term.replace(/-/g, ' ')}? Definition, examples, and how it applies to faceless AI reel creation.`,
          keywords: [
            `${term.replace(/-/g, ' ')} definition`,
            term,
            'AI video terms',
            'reel glossary',
          ],
          seed_params: { term },
        }),
      );
    }
    return rows;
  }

  // ─── Translations ─────────────────────────────────────────────────────────
  private buildTranslationRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const languages = dims.languages ?? [];
    const niches = dims.niches ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const language of languages) {
      const slug = `${language}-reels`;
      rows.push(
        this.makeRow(PseoPlaybook.TRANSLATIONS, slug, `/create/${slug}`, {
          title: `Create ${this.capitalize(language)} Reels with AI — AutoReels`,
          meta_description: `Generate faceless ${language} reels with AI voiceover in ${language}. Perfect for creators targeting ${language}-speaking audiences.`,
          keywords: [
            `${language} reels`,
            `AI ${language} voiceover`,
            `create ${language} video`,
            language,
          ],
          seed_params: { language },
        }),
      );
      for (const niche of niches) {
        const s2 = `${language}-${niche}-reels`;
        rows.push(
          this.makeRow(PseoPlaybook.TRANSLATIONS, s2, `/create/${s2}`, {
            title: `${this.capitalize(language)} ${this.capitalize(niche)} Reels — AI Generator`,
            meta_description: `Create ${language} ${niche} reels with AI. Script, voiceover, and visuals in ${language} automatically.`,
            keywords: [`${language} ${niche} reels`, language, niche, 'AI multilingual reel'],
            seed_params: { language, niche },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Directory ────────────────────────────────────────────────────────────
  private buildDirectoryRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const niches = dims.niches ?? [];
    const platforms = dims.platforms ?? [];
    const countries = dims.countries ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const niche of niches) {
      const slug = `${niche}-creators`;
      rows.push(
        this.makeRow(PseoPlaybook.DIRECTORY, slug, `/directory/${slug}`, {
          title: `Top ${this.capitalize(niche)} Faceless Creators — Directory`,
          meta_description: `Discover top faceless ${niche} content creators. Tools, strategies, and how AutoReels powers the best ${niche} channels.`,
          keywords: [
            `${niche} creators`,
            `faceless ${niche} creator`,
            niche,
            'AI content creator directory',
          ],
          seed_params: { niche },
        }),
      );
    }
    for (const platform of platforms) {
      for (const country of countries.slice(0, 5)) {
        const slug = `${platform}-creators-${country}`;
        rows.push(
          this.makeRow(PseoPlaybook.DIRECTORY, slug, `/directory/${slug}`, {
            title: `Top ${this.capitalize(platform)} Creators in ${this.capitalize(country)}`,
            meta_description: `Directory of top ${platform} faceless creators from ${country}. Learn their tools, niches, and posting strategies.`,
            keywords: [
              `${platform} creators ${country}`,
              platform,
              country,
              'faceless creator directory',
            ],
            seed_params: { platform, country },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Profiles ─────────────────────────────────────────────────────────────
  private buildProfileRows(dims: Record<string, string[]>): Partial<PseoPage>[] {
    const toolTypes = dims.tool_types ?? [];
    const niches = dims.niches ?? [];
    const rows: Partial<PseoPage>[] = [];
    for (const toolType of toolTypes) {
      rows.push(
        this.makeRow(PseoPlaybook.PROFILES, toolType, `/tools/${toolType}`, {
          title: `Best ${this.capitalize(toolType)} — AutoReels`,
          meta_description: `AutoReels is the best ${toolType.replace(/-/g, ' ')} for faceless creators. AI-powered, no editing required.`,
          keywords: [
            toolType.replace(/-/g, ' '),
            `best ${toolType}`,
            'AI video tool',
            'faceless reel tool',
          ],
          seed_params: { tool_type: toolType },
        }),
      );
      for (const niche of niches.slice(0, 4)) {
        const s2 = `${toolType}-${niche}`;
        rows.push(
          this.makeRow(PseoPlaybook.PROFILES, s2, `/tools/${toolType}/${niche}`, {
            title: `Best ${this.capitalize(toolType)} for ${this.capitalize(niche)}`,
            meta_description: `The best ${toolType.replace(/-/g, ' ')} for ${niche} content. AutoReels automates your ${niche} reel creation.`,
            keywords: [`${toolType} for ${niche}`, toolType, niche, 'AI video tool'],
            seed_params: { tool_type: toolType, niche },
          }),
        );
      }
    }
    return rows;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private makeRow(
    playbook: PseoPlaybook,
    slug: string,
    canonicalPath: string,
    data: {
      title: string;
      meta_description: string;
      keywords: string[];
      seed_params: Record<string, string>;
    },
  ): Partial<PseoPage> {
    return {
      slug,
      canonical_path: canonicalPath,
      playbook,
      status: PseoPageStatus.DRAFT,
      title: data.title,
      meta_description: data.meta_description,
      keywords: data.keywords,
      seed_params: data.seed_params,
      related_paths: [],
    };
  }

  private capitalize(str: string): string {
    return str
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
