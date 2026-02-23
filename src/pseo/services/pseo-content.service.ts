import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PseoPage, PseoPlaybook } from '../entities/pseo-page.entity';

@Injectable()
export class PseoContentService {
  private readonly logger = new Logger(PseoContentService.name);
  private model: any;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — pSEO content generation will fail');
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  async generateContent(page: PseoPage): Promise<Record<string, any>> {
    switch (page.playbook) {
      case PseoPlaybook.TEMPLATES:
        return this.generateTemplates(page);
      case PseoPlaybook.CURATION:
        return this.generateCuration(page);
      case PseoPlaybook.CONVERSIONS:
        return this.generateConversions(page);
      case PseoPlaybook.COMPARISONS:
        return this.generateComparisons(page);
      case PseoPlaybook.EXAMPLES:
        return this.generateExamples(page);
      case PseoPlaybook.LOCATIONS:
        return this.generateLocations(page);
      case PseoPlaybook.PERSONAS:
        return this.generatePersonas(page);
      case PseoPlaybook.INTEGRATIONS:
        return this.generateIntegrations(page);
      case PseoPlaybook.GLOSSARY:
        return this.generateGlossary(page);
      case PseoPlaybook.TRANSLATIONS:
        return this.generateTranslations(page);
      case PseoPlaybook.DIRECTORY:
        return this.generateDirectory(page);
      case PseoPlaybook.PROFILES:
        return this.generateProfiles(page);
      default:
        throw new Error(`Unknown playbook: ${page.playbook}`);
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────
  private async generateTemplates(page: PseoPage): Promise<Record<string, any>> {
    const { niche, platform } = page.seed_params || {};
    const prompt = `You are a content strategist for AutoReels, an AI faceless reel generator.
Generate a JSON object for a page about ${niche}${platform ? ` ${platform}` : ''} reel templates.

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "hero_headline": "string (H1, max 70 chars, includes niche and 'reel templates')",
  "hero_subhead": "string (1-2 sentences describing what users get)",
  "template_cards": [
    {
      "title": "string",
      "tone": "string (motivational|educational|humorous|storytelling|controversial)",
      "hook": "string (opening line, 10-15 words)",
      "cta": "string (call-to-action, 8-12 words)"
    }
  ],
  "how_it_works": [
    { "step": 1, "title": "string", "description": "string" },
    { "step": 2, "title": "string", "description": "string" },
    { "step": 3, "title": "string", "description": "string" }
  ],
  "faqs": [
    { "question": "string", "answer": "string (2-3 sentences)" }
  ]
}

Requirements: template_cards = 6 items (each different tone). faqs = 5 items specific to ${niche}${platform ? ` on ${platform}` : ''}. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Curation ─────────────────────────────────────────────────────────────
  private async generateCuration(page: PseoPage): Promise<Record<string, any>> {
    const { niche, tone } = page.seed_params || {};
    const prompt = `You are a viral content strategist. Generate content JSON for a ${niche}${tone ? ` (${tone} tone)` : ''} reel ideas curation page.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, max 70 chars)",
  "hero_subhead": "string (2 sentences about why these ideas work)",
  "ideas": [
    {
      "title": "string (reel topic)",
      "hook": "string (opening line, 10-15 words)",
      "why_it_works": "string (1-2 sentences)",
      "best_platform": "string (instagram|youtube|tiktok|linkedin)"
    }
  ],
  "posting_tips": ["string", "string", "string"],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: ideas = 10 items about ${niche}${tone ? ` with ${tone} tone` : ''}. faqs = 4 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Conversions ──────────────────────────────────────────────────────────
  private async generateConversions(page: PseoPage): Promise<Record<string, any>> {
    const { plan, persona } = page.seed_params || {};
    const prompt = `Generate pricing page content JSON for AutoReels ${plan} plan${persona ? ` targeting ${persona}` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, benefit-driven, max 70 chars)",
  "hero_subhead": "string (1-2 sentences)",
  "features": [{ "name": "string", "description": "string", "included": true }],
  "benefits": ["string", "string", "string", "string"],
  "use_cases": ["string", "string", "string"],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: features = 8 items. faqs = 5 items${persona ? ` focused on ${persona}` : ''}. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Comparisons ──────────────────────────────────────────────────────────
  private async generateComparisons(page: PseoPage): Promise<Record<string, any>> {
    const { competitor, persona } = page.seed_params || {};
    const prompt = `Generate a comparison page JSON for AutoReels vs ${competitor}${persona ? ` for ${persona}` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, both product names, max 70 chars)",
  "verdict": "string (2-3 sentence summary)",
  "comparison_table": [
    {
      "feature": "string",
      "autoreels": "string",
      "competitor": "string",
      "winner": "autoreels|competitor|tie"
    }
  ],
  "pros_autoreels": ["string", "string", "string", "string"],
  "cons_competitor": ["string", "string", "string"],
  "best_for": {
    "autoreels": "string",
    "competitor": "string"
  },
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: comparison_table = 8 features${persona ? ` relevant to ${persona}` : ''}. faqs = 5 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Examples ─────────────────────────────────────────────────────────────
  private async generateExamples(page: PseoPage): Promise<Record<string, any>> {
    const { niche, tone } = page.seed_params || {};
    const prompt = `Generate reel examples content JSON for ${niche}${tone ? ` (${tone} tone)` : ''} faceless reels.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, max 70 chars)",
  "hero_subhead": "string (2 sentences)",
  "examples": [
    {
      "title": "string",
      "hook": "string (first line, 10-15 words)",
      "script_excerpt": "string (3-4 sentences)",
      "visual_style": "string",
      "estimated_views": "string (e.g. 50K-200K)",
      "why_it_works": "string (1-2 sentences)"
    }
  ],
  "key_takeaways": ["string", "string", "string"],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: examples = 5 items, all ${niche}${tone ? ` with ${tone} tone` : ''}. faqs = 4 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Locations ────────────────────────────────────────────────────────────
  private async generateLocations(page: PseoPage): Promise<Record<string, any>> {
    const { country, niche } = page.seed_params || {};
    const prompt = `Generate location-specific content JSON for AutoReels users in ${country}${niche ? ` creating ${niche} reels` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, mentions ${country}, max 70 chars)",
  "local_headline": "string (localized subheading)",
  "local_context": "string (2-3 sentences about content creation in ${country})",
  "top_niches": ["string", "string", "string", "string", "string"],
  "pricing_note": "string (AutoReels is globally accessible, credit-based pricing)",
  "creator_tips": [{ "tip": "string", "reason": "string" }],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: creator_tips = 4 items specific to ${country}. faqs = 4 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Personas ─────────────────────────────────────────────────────────────
  private async generatePersonas(page: PseoPage): Promise<Record<string, any>> {
    const { persona, niche } = page.seed_params || {};
    const prompt = `Generate a persona-targeting page JSON for AutoReels targeting ${persona}${niche ? ` creating ${niche} reels` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, speaks to ${persona}, max 70 chars)",
  "hero_subhead": "string (2 sentences addressing pain point)",
  "pain_points": [{ "problem": "string", "agitation": "string" }],
  "solution_steps": [
    { "step": 1, "action": "string", "result": "string" },
    { "step": 2, "action": "string", "result": "string" },
    { "step": 3, "action": "string", "result": "string" }
  ],
  "benefits": ["string", "string", "string", "string", "string"],
  "social_proof": { "stat": "string", "quote": "string" },
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: pain_points = 4 items specific to ${persona}. faqs = 5 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Integrations ─────────────────────────────────────────────────────────
  private async generateIntegrations(page: PseoPage): Promise<Record<string, any>> {
    const { integration, use_case } = page.seed_params || {};
    const prompt = `Generate an integration guide JSON for AutoReels + ${integration}${use_case ? ` (${use_case.replace(/-/g, ' ')})` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, AutoReels + ${integration}, max 70 chars)",
  "hero_subhead": "string (benefit statement, 2 sentences)",
  "setup_steps": [
    { "step": 1, "title": "string", "description": "string", "tip": "string" },
    { "step": 2, "title": "string", "description": "string", "tip": "string" },
    { "step": 3, "title": "string", "description": "string", "tip": "string" },
    { "step": 4, "title": "string", "description": "string", "tip": "string" }
  ],
  "use_cases": ["string", "string", "string"],
  "benefits": ["string", "string", "string", "string"],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: setup_steps = 4 practical steps for ${integration}. faqs = 4 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Glossary ─────────────────────────────────────────────────────────────
  private async generateGlossary(page: PseoPage): Promise<Record<string, any>> {
    const { term } = page.seed_params || {};

    if (!term) {
      return {
        hero_headline: 'AI Video & Faceless Reel Glossary',
        hero_subhead: 'Master the language of viral content creation. Every term explained.',
        intro:
          "Whether you're just starting your faceless content journey or scaling to 100 reels/month, understanding these terms will help you create better content faster.",
        categories: [
          {
            name: 'Content Strategy',
            terms: ['viral-hook', 'content-pillar', 'niche-content', 'hook-copy'],
          },
          {
            name: 'AI Tools',
            terms: ['ai-voiceover', 'ai-script', 'text-to-speech', 'ai-generated-video'],
          },
          {
            name: 'Video Production',
            terms: ['b-roll', 'kenburns-effect', 'scene-transition', 'aspect-ratio'],
          },
          {
            name: 'Platform Terms',
            terms: ['reels-algorithm', 'shorts-algorithm', 'tiktok-fyp', 'watch-time'],
          },
        ],
      };
    }

    const prompt = `Generate a glossary entry JSON for the term "${term.replace(/-/g, ' ')}" in AI video creation and faceless reels context.

Return ONLY valid JSON (no markdown):
{
  "term": "${term.replace(/-/g, ' ')}",
  "definition_short": "string (1 sentence, max 25 words)",
  "definition_long": "string (3-4 sentences with context and relevance to faceless reels)",
  "related_terms": ["string", "string", "string"],
  "examples": [
    { "scenario": "string (1 sentence)", "explanation": "string (1-2 sentences)" },
    { "scenario": "string", "explanation": "string" }
  ],
  "faqs": [
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" }
  ]
}

Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Translations ─────────────────────────────────────────────────────────
  private async generateTranslations(page: PseoPage): Promise<Record<string, any>> {
    const { language, niche } = page.seed_params || {};
    const prompt = `Generate multilingual content page JSON for creating ${language} reels${niche ? ` about ${niche}` : ''} using AutoReels AI.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, mentions ${language}, max 70 chars)",
  "hero_subhead": "string (benefit for ${language}-speaking creators, 2 sentences)",
  "language_context": "string (2-3 sentences about the ${language} creator market)",
  "language_examples": [
    {
      "topic": "string (reel topic in English)",
      "hook_english": "string (hook in English)",
      "hook_translated": "string (hook in ${language} using Latin characters)",
      "why_it_works": "string"
    }
  ],
  "audience_tips": ["string", "string", "string"],
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: language_examples = 4 items${niche ? ` all about ${niche}` : ''}. faqs = 4 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Directory ────────────────────────────────────────────────────────────
  private generateDirectory(page: PseoPage): Record<string, any> {
    const { niche, platform, country } = page.seed_params || {};
    const context = niche ? `${niche} faceless creators` : `${platform} creators from ${country}`;

    return {
      hero_headline: `Top ${this.capitalize(context)} — Creator Directory`,
      hero_subhead: `Discover the tools, niches, and strategies powering the best ${context}.`,
      creators: [
        {
          name: 'Anonymous Creator 1',
          niche: niche || 'general',
          platform: platform || 'multi-platform',
          tool: 'AutoReels',
          followers: '50K+',
        },
        {
          name: 'Anonymous Creator 2',
          niche: niche || 'general',
          platform: platform || 'multi-platform',
          tool: 'AutoReels',
          followers: '120K+',
        },
        {
          name: 'Anonymous Creator 3',
          niche: niche || 'general',
          platform: platform || 'multi-platform',
          tool: 'AutoReels',
          followers: '30K+',
        },
      ],
      how_they_create: [
        'Use AI tools like AutoReels to generate scripts and voiceovers',
        'Batch-create 30+ reels per week with templates',
        'Post consistently using a content calendar',
        'Repurpose content across multiple platforms',
      ],
    };
  }

  // ─── Profiles ─────────────────────────────────────────────────────────────
  private async generateProfiles(page: PseoPage): Promise<Record<string, any>> {
    const { tool_type, niche } = page.seed_params || {};
    const toolName = tool_type?.replace(/-/g, ' ') || 'AI video tool';
    const prompt = `Generate a tool profile page JSON positioning AutoReels as the best ${toolName}${niche ? ` for ${niche}` : ''}.

Return ONLY valid JSON (no markdown):
{
  "hero_headline": "string (H1, positions AutoReels as best ${toolName}, max 70 chars)",
  "hero_subhead": "string (2 sentences, benefit-driven)",
  "tool_description": "string (3-4 sentences describing AutoReels as a ${toolName})",
  "key_features": [{ "name": "string", "description": "string" }],
  "use_cases": [{ "use_case": "string", "example": "string" }],
  "comparison_note": "string (2 sentences on why AutoReels beats alternatives)",
  "faqs": [{ "question": "string", "answer": "string" }]
}

Requirements: key_features = 6 items${niche ? ` for ${niche}` : ''}. use_cases = 4 items. faqs = 5 items. Return ONLY JSON.`;

    return this.callAI(prompt, page.slug);
  }

  // ─── Gemini call ──────────────────────────────────────────────────────────
  private async callAI(prompt: string, slug: string): Promise<Record<string, any>> {
    if (!this.model) {
      throw new Error('Gemini model not initialised — GEMINI_API_KEY missing');
    }

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text: string = response.text();

    // Strip any accidental markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      this.logger.debug(`Generated content for ${slug} (${cleaned.length} chars)`);
      return parsed;
    } catch (err) {
      this.logger.error(
        `JSON parse failed for ${slug}: ${err.message}\nRaw: ${cleaned.slice(0, 200)}`,
      );
      throw new Error(`Gemini returned non-JSON for ${slug}: ${err.message}`);
    }
  }

  private capitalize(str: string): string {
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
