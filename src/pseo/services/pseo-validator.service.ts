import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PseoPage, PseoPlaybook } from '../entities/pseo-page.entity';
import { PseoPlaybookConfig } from '../entities/pseo-playbook-config.entity';

export interface ValidationResult {
  passed: boolean;
  score: number;
  reasons: string[];
}

/** Fallback thresholds used if DB lookup fails or row is missing */
const FALLBACK_WORD_COUNT: Record<string, number> = {
  [PseoPlaybook.TEMPLATES]: 600,
  [PseoPlaybook.CURATION]: 600,
  [PseoPlaybook.CONVERSIONS]: 400,
  [PseoPlaybook.COMPARISONS]: 600,
  [PseoPlaybook.EXAMPLES]: 600,
  [PseoPlaybook.LOCATIONS]: 400,
  [PseoPlaybook.PERSONAS]: 500,
  [PseoPlaybook.INTEGRATIONS]: 400,
  [PseoPlaybook.GLOSSARY]: 300,
  [PseoPlaybook.TRANSLATIONS]: 400,
  [PseoPlaybook.DIRECTORY]: 300,
  [PseoPlaybook.PROFILES]: 400,
};

const REQUIRED_FIELDS: Record<PseoPlaybook, string[]> = {
  [PseoPlaybook.TEMPLATES]: ['hero_headline', 'template_cards', 'faqs'],
  [PseoPlaybook.CURATION]: ['hero_headline', 'ideas', 'faqs'],
  [PseoPlaybook.CONVERSIONS]: ['hero_headline', 'features', 'faqs'],
  [PseoPlaybook.COMPARISONS]: ['hero_headline', 'comparison_table', 'verdict', 'faqs'],
  [PseoPlaybook.EXAMPLES]: ['hero_headline', 'examples', 'faqs'],
  [PseoPlaybook.LOCATIONS]: ['hero_headline', 'local_headline', 'faqs'],
  [PseoPlaybook.PERSONAS]: ['hero_headline', 'pain_points', 'solution_steps', 'faqs'],
  [PseoPlaybook.INTEGRATIONS]: ['hero_headline', 'setup_steps', 'faqs'],
  [PseoPlaybook.GLOSSARY]: ['term', 'definition_short', 'definition_long'],
  [PseoPlaybook.TRANSLATIONS]: ['hero_headline', 'language_examples', 'faqs'],
  [PseoPlaybook.DIRECTORY]: ['hero_headline', 'creators'],
  [PseoPlaybook.PROFILES]: ['hero_headline', 'tool_description', 'faqs'],
};

@Injectable()
export class PseoValidatorService {
  private readonly logger = new Logger(PseoValidatorService.name);

  /** 60-second in-memory cache for playbook configs */
  private configsCache: Map<string, PseoPlaybookConfig> | null = null;
  private configsExpiry = 0;

  constructor(
    @InjectRepository(PseoPlaybookConfig)
    private readonly configsRepo: Repository<PseoPlaybookConfig>,
  ) {}

  async validate(page: PseoPage): Promise<ValidationResult> {
    const configs = await this.getConfigs();
    const config = configs.get(page.playbook);

    const reasons: string[] = [];
    let score = 100;

    if (!page.content) {
      return { passed: false, score: 0, reasons: ['No content generated'] };
    }

    // 1. Word count check
    const wordCount = this.countWords(page.content);
    const minWords = config?.min_word_count ?? FALLBACK_WORD_COUNT[page.playbook] ?? 300;
    if (wordCount < minWords) {
      const penalty = Math.round(((minWords - wordCount) / minWords) * 40);
      score -= penalty;
      reasons.push(`Word count ${wordCount} below minimum ${minWords}`);
    }

    // 2. Required fields check
    const requiredFields = REQUIRED_FIELDS[page.playbook] || [];
    for (const field of requiredFields) {
      if (!page.content[field]) {
        score -= 15;
        reasons.push(`Missing required field: ${field}`);
      }
    }

    // 3. Title and meta present
    if (!page.title || page.title.length < 10) {
      score -= 10;
      reasons.push('Title too short or missing');
    }
    if (!page.meta_description || page.meta_description.length < 50) {
      score -= 10;
      reasons.push('Meta description too short or missing');
    }

    // 4. FAQs check (important for rich snippets)
    const hasFaqs =
      page.content.faqs && Array.isArray(page.content.faqs) && page.content.faqs.length >= 2;
    if (!hasFaqs && page.playbook !== PseoPlaybook.DIRECTORY) {
      score -= 10;
      reasons.push('Missing or insufficient FAQs (min 2)');
    }

    score = Math.max(0, score);
    const minScore = config?.min_quality_score ?? 60;
    const passed = score >= minScore;

    this.logger.debug(`Validation for ${page.slug}: score=${score}, passed=${passed}`);
    return { passed, score, reasons };
  }

  private async getConfigs(): Promise<Map<string, PseoPlaybookConfig>> {
    const now = Date.now();
    if (this.configsCache && this.configsExpiry > now) {
      return this.configsCache;
    }
    const rows = await this.configsRepo.find();
    this.configsCache = new Map(rows.map((r) => [r.playbook, r]));
    this.configsExpiry = now + 60_000;
    return this.configsCache;
  }

  private countWords(content: Record<string, any>): number {
    const text = JSON.stringify(content);
    return text.split(/\s+/).filter(Boolean).length;
  }
}
