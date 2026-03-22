import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { ScenePlanSchema } from '../../langchain/schemas/scene-plan.schema';
import { ScriptProcessorService } from '../script-processor.service';
import type { ScenePlan, ScenePlanScene } from '../interfaces/graphic-motion.interface';

const SCENE_PLANNER_SYSTEM_PROMPT = `You are a video scene planner for short-form premium SaaS and promo content that feeds a graphic motion engine (title cards, quote cards, feature highlights, impact words, stats cards, steps cards, countdown badges).

Given a script or short prompt, output a JSON object with:
- videoStyle: string (e.g. "premium-saas", "minimal")
- globalTone: string (e.g. "confident", "urgent", "calm")
- preferredSceneLength: OPTIONAL. One of "short" (2-3s per scene), "medium" (4-5s), "long" (5-7s), or a number (seconds per scene). Omit to use default pacing.
- scenes: array of objects. Each scene MUST have:
  - text: string (main headline or quote for that scene; keep punchy)
  - sceneType: "intro"|"problem"|"feature"|"cta"
  - emphasisLevel: number 0-1
  - importanceScore: number 0-1
  And OPTIONALLY (use these so the motion engine can render rich templates):
  - label: short uppercase label, MAX 2–3 words (e.g. "INTRODUCTION", "THE PROBLEM", "FEATURE", "CALL TO ACTION"). Use for first/last or key beats.
  - subHeadline: exactly ONE short line under the main text for title-card (e.g. a one-line tagline). Max ~15 words.
  - supportingText: exactly ONE line of supporting copy for feature scenes. Max ~20 words.
  - authorLine: for quote-style scenes only, short attribution (e.g. "Steve Jobs", "Our CEO"). Max ~8 words.
  - suggestedTemplateType: "title-card"|"quote-card"|"feature-highlight"|"impact-full-bleed"|"stats-card"|"steps-card"|"split-accent"|"countdown-badge" when obvious. Use stats-card for numeric metrics, steps-card for lists/numbered steps, countdown-badge for CTA with a number, split-accent for feature sections with supporting text.
  - headlineEmphasis: OPTIONAL. "high" for key scenes (strongest headline treatment), "medium" for supporting. Omit when not needed.
  - backgroundType: OPTIONAL. Background type that fits the scene tone: "animated-gradient" for celebratory/energetic, "radial-glow" for urgent/CTA/dramatic, "dot-grid" for calm/intro, "geometric-lines" for neutral/corporate, "noise-texture" for premium/dark, "flat-light" for clean/minimal, "flat-dark" for bold/dark. Omit to use video-level default.
  - highlightWords: OPTIONAL. Array of 1–2 power words from the scene text to render in accent color. Keep these to the most impactful words only.
  - iconSuggestion: OPTIONAL. A single emoji or short keyword (e.g. "rocket", "🚀", "chart") for decorative shape overlay. Only for scenes that benefit from visual decoration.

Split content into clear scenes. First scene is often intro with a strong label; last often cta. For quotes, set authorLine. For feature bullets, set supportingText. Keep all optional fields SHORT so the motion engine renders cleanly. emphasisLevel and importanceScore are 0-1.
Respond with only valid JSON, no markdown code fences.`;

@Injectable()
export class ScenePlannerService {
  private readonly logger = new Logger(ScenePlannerService.name);

  private readonly chain = ChatPromptTemplate.fromMessages([
    ['system', SCENE_PLANNER_SYSTEM_PROMPT],
    [
      'human',
      'Create a scene plan for this script or prompt:\n\n{scriptOrPrompt}\n\nRespond with only valid JSON.',
    ],
  ]).pipe(this.registry.getStructuredGemini(ScenePlanSchema));

  constructor(
    private readonly registry: LangChainRegistry,
    private readonly scriptProcessor: ScriptProcessorService,
  ) {}

  /**
   * Plan scenes from script or prompt using Gemini. On failure or missing key, fallback to script processor.
   */
  async plan(scriptOrPrompt: string, projectId: string): Promise<ScenePlan> {
    if (!scriptOrPrompt?.trim()) {
      return this.fallbackToScriptProcessor(scriptOrPrompt || '');
    }

    try {
      const result = await this.chain.invoke({ scriptOrPrompt: scriptOrPrompt.trim() });

      const scenes: ScenePlanScene[] = result.scenes.map((s) => ({
        text: s.text,
        sceneType: s.sceneType,
        emphasisLevel: s.emphasisLevel,
        importanceScore: s.importanceScore,
        label: s.label,
        subHeadline: s.subHeadline,
        supportingText: s.supportingText,
        authorLine: s.authorLine,
        suggestedTemplateType: s.suggestedTemplateType,
        headlineEmphasis: s.headlineEmphasis,
        backgroundType: s.backgroundType,
        highlightWords: s.highlightWords,
        iconSuggestion: s.iconSuggestion,
      }));

      if (scenes.length > 0) {
        return {
          videoStyle: result.videoStyle,
          globalTone: result.globalTone,
          preferredSceneLength:
            typeof result.preferredSceneLength === 'string' ||
            typeof result.preferredSceneLength === 'number'
              ? result.preferredSceneLength
              : undefined,
          scenes,
        };
      }
    } catch (err) {
      this.logger.warn(
        `ScenePlanner Gemini failed for project ${projectId}, using fallback`,
        err instanceof Error ? err.message : err,
      );
    }

    return this.fallbackToScriptProcessor(scriptOrPrompt);
  }

  private fallbackToScriptProcessor(script: string): ScenePlan {
    const blocks = this.scriptProcessor.process(script.trim() || ' ', {
      splitMode: 'sentence',
      defaultPreset: 'word-reveal',
    });
    const n = blocks.length;
    const scenes: ScenePlanScene[] = blocks.map((block, i) => ({
      text: block.text,
      sceneType: i === 0 ? 'intro' : i === n - 1 ? 'cta' : 'feature',
      emphasisLevel: 0.5,
      importanceScore: 0.3 + (0.4 * (i + 1)) / Math.max(1, n),
      visualTreatment: undefined,
      label: i === 0 ? 'INTRODUCTION' : i === n - 1 ? 'CALL TO ACTION' : undefined,
    }));
    return {
      videoStyle: 'premium-saas',
      globalTone: 'confident',
      scenes,
    };
  }
}
