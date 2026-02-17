import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ScriptProcessorService } from '../script-processor.service';
import type {
  ScenePlan,
  ScenePlanScene,
  TemplateType,
} from '../interfaces/graphic-motion.interface';

const SCENE_PLANNER_PROMPT = `You are a video scene planner for short-form premium SaaS and promo content that feeds a graphic motion engine (title cards, quote cards, feature highlights, impact words).

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
  - suggestedTemplateType: "title-card"|"quote-card"|"feature-highlight"|"impact-full-bleed" when obvious (e.g. one word → impact-full-bleed, long quote → quote-card, intro → title-card).
  - headlineEmphasis: OPTIONAL. "high" for key scenes (strongest headline treatment), "medium" for supporting. Omit when not needed.

Split content into clear scenes. First scene is often intro with a strong label; last often cta. For quotes, set authorLine. For feature bullets, set supportingText. Keep all optional fields SHORT so the motion engine renders cleanly. emphasisLevel and importanceScore are 0-1.
Respond with only valid JSON, no markdown code fences.`;

@Injectable()
export class ScenePlannerService {
  private readonly logger = new Logger(ScenePlannerService.name);
  private readonly model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;

  constructor(private readonly scriptProcessor: ScriptProcessorService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey?.trim()) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } else {
      this.logger.warn('GEMINI_API_KEY not set; ScenePlanner will use fallback only');
    }
  }

  /**
   * Plan scenes from script or prompt using Gemini. On failure or missing key, fallback to script processor.
   */
  async plan(scriptOrPrompt: string, projectId: string): Promise<ScenePlan> {
    if (!scriptOrPrompt?.trim()) {
      return this.fallbackToScriptProcessor(scriptOrPrompt || '');
    }
    if (this.model) {
      try {
        const userPrompt = `Create a scene plan for this script or prompt:\n\n${scriptOrPrompt.trim()}\n\nRespond with only valid JSON.`;
        const result = await this.model.generateContent([SCENE_PLANNER_PROMPT, userPrompt]);
        const response = result.response;
        const content = response.text();
        if (content) {
          const raw = content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const scenes = Array.isArray(parsed.scenes)
            ? (parsed.scenes as ScenePlanScene[]).map((s) => ({
                text: String(s?.text ?? ''),
                sceneType: this.normalizeSceneType(s?.sceneType),
                emphasisLevel: this.clamp01(Number(s?.emphasisLevel ?? 0.5)),
                importanceScore: this.clamp01(Number(s?.importanceScore ?? 0.5)),
                visualTreatment: s?.visualTreatment as
                  | ScenePlanScene['visualTreatment']
                  | undefined,
                label: s?.label != null ? String(s.label).trim() || undefined : undefined,
                subHeadline:
                  s?.subHeadline != null ? String(s.subHeadline).trim() || undefined : undefined,
                supportingText:
                  s?.supportingText != null
                    ? String(s.supportingText).trim() || undefined
                    : undefined,
                authorLine:
                  s?.authorLine != null ? String(s.authorLine).trim() || undefined : undefined,
                suggestedTemplateType: this.normalizeTemplateType(s?.suggestedTemplateType),
                headlineEmphasis: this.normalizeHeadlineEmphasis(s?.headlineEmphasis),
              }))
            : [];
          if (scenes.length > 0) {
            return {
              videoStyle: String(parsed.videoStyle ?? 'premium-saas'),
              globalTone: String(parsed.globalTone ?? 'confident'),
              preferredSceneLength:
                typeof parsed.preferredSceneLength === 'string' ||
                typeof parsed.preferredSceneLength === 'number'
                  ? parsed.preferredSceneLength
                  : undefined,
              scenes,
            };
          }
        }
      } catch (err) {
        this.logger.warn(
          `ScenePlanner Gemini failed for project ${projectId}, using fallback`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return this.fallbackToScriptProcessor(scriptOrPrompt);
  }

  private clamp01(n: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.5));
  }

  private normalizeSceneType(v: unknown): ScenePlanScene['sceneType'] {
    const s = String(v).toLowerCase();
    if (['intro', 'problem', 'feature', 'cta'].includes(s)) return s as ScenePlanScene['sceneType'];
    return 'feature';
  }

  private normalizeTemplateType(v: unknown): TemplateType | undefined {
    const s = String(v).toLowerCase();
    if (['title-card', 'quote-card', 'feature-highlight', 'impact-full-bleed'].includes(s)) {
      return s as TemplateType;
    }
    return undefined;
  }

  private normalizeHeadlineEmphasis(v: unknown): 'high' | 'medium' | undefined {
    const s = String(v).toLowerCase();
    if (s === 'high' || s === 'medium') return s;
    return undefined;
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
