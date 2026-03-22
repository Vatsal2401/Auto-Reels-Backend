import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { ViralCaptionSchema } from '../../langchain/schemas/viral-caption.schema';

export interface ViralCaptionLine {
  line: string;
  highlight: string | null;
  intensity: number;
}

export interface ViralCaptionResult {
  hook_strength: number;
  captions: ViralCaptionLine[];
}

const VIRAL_CAPTION_SYSTEM_PROMPT = `You are a viral short-form video caption optimizer. Your job is to rewrite a video script into punchy, emotionally charged caption lines that maximize viewer retention and engagement.

RULES:
1. Split the script into short, impactful lines (2–5 words each, occasionally up to 7 for complex ideas).
2. Each line should feel like a punchy thought — complete enough to make sense alone.
3. Preserve the original meaning and ALL content — do not omit any ideas from the script.
4. For each line, identify one "highlight" power word (the most emotionally charged or important word). If no word stands out, set highlight to null.
5. Rate the emotional intensity of each line from 1 (calm/informational) to 5 (explosive/shocking).
6. Rate the overall hook strength of the opening line from 1 (weak) to 10 (irresistible).
7. Lines should follow the natural speaking rhythm. Do NOT add punctuation at end of lines.
8. Do NOT use any markdown formatting inside line text. No **bold**, no *italic*, no __underline__. Plain text only.
9. Output ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT FORMAT (strict JSON):
{{
  "hook_strength": <number 1-10>,
  "captions": [
    {{ "line": "<line text>", "highlight": "<word or null>", "intensity": <1-5> }},
    ...
  ]
}}

SCRIPT TO OPTIMIZE:`;

@Injectable()
export class ViralCaptionOptimizerService {
  private readonly logger = new Logger(ViralCaptionOptimizerService.name);

  private readonly chain = ChatPromptTemplate.fromMessages([
    ['system', VIRAL_CAPTION_SYSTEM_PROMPT],
    ['human', '{transcript}'],
  ]).pipe(this.registry.getStructuredGemini(ViralCaptionSchema));

  constructor(private readonly registry: LangChainRegistry) {}

  async optimize(scriptText: string): Promise<ViralCaptionResult | null> {
    if (!scriptText || !scriptText.trim()) {
      return null;
    }

    try {
      const result = await this.chain.invoke({ transcript: scriptText.trim() });

      // Post-process: convert "" → null for highlight (Gemini can't return null directly)
      // Safety: strip any markdown formatting from line text that Gemini may have added
      result.captions.forEach((c) => {
        if (c.highlight === '') c.highlight = null;
        c.line = c.line
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/__([^_]+)__/g, '$1')
          .replace(/_([^_]+)_/g, '$1')
          .trim();
      });

      this.logger.log(
        `Viral optimizer: hook_strength=${result.hook_strength}, captions=${result.captions.length}`,
      );
      return result;
    } catch (err) {
      this.logger.warn(
        `Viral optimizer failed: ${err?.message ?? err} — falling back to heuristic splitting`,
      );
      return null;
    }
  }
}
