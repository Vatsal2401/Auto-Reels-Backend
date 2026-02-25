import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ViralCaptionLine {
  line: string;
  highlight: string | null;
  intensity: number;
}

export interface ViralCaptionResult {
  hook_strength: number;
  captions: ViralCaptionLine[];
}

const VIRAL_CAPTION_PROMPT = `You are a viral short-form video caption optimizer. Your job is to rewrite a video script into punchy, emotionally charged caption lines that maximize viewer retention and engagement.

RULES:
1. Split the script into short, impactful lines (2–5 words each, occasionally up to 7 for complex ideas).
2. Each line should feel like a punchy thought — complete enough to make sense alone.
3. Preserve the original meaning and ALL content — do not omit any ideas from the script.
4. For each line, identify one "highlight" power word (the most emotionally charged or important word). If no word stands out, set highlight to null.
5. Rate the emotional intensity of each line from 1 (calm/informational) to 5 (explosive/shocking).
6. Rate the overall hook strength of the opening line from 1 (weak) to 10 (irresistible).
7. Lines should follow the natural speaking rhythm. Do NOT add punctuation at end of lines.
8. Output ONLY valid JSON — no markdown, no explanation, no code fences.

OUTPUT FORMAT (strict JSON):
{
  "hook_strength": <number 1-10>,
  "captions": [
    { "line": "<line text>", "highlight": "<word or null>", "intensity": <1-5> },
    ...
  ]
}

SCRIPT TO OPTIMIZE:
{{TRANSCRIPT}}`;

@Injectable()
export class ViralCaptionOptimizerService {
  private readonly logger = new Logger(ViralCaptionOptimizerService.name);
  private model: any;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — viral caption optimizer will be disabled');
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  async optimize(scriptText: string): Promise<ViralCaptionResult | null> {
    if (!this.model) {
      this.logger.warn('Viral caption optimizer: model not initialized (missing API key)');
      return null;
    }

    if (!scriptText || !scriptText.trim()) {
      return null;
    }

    try {
      const prompt = VIRAL_CAPTION_PROMPT.replace('{{TRANSCRIPT}}', scriptText.trim());
      const result = await this.model.generateContent(prompt);
      const raw = result.response.text().trim();

      // Strip markdown code fences if present
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      const parsed = JSON.parse(jsonStr) as ViralCaptionResult;

      if (
        typeof parsed.hook_strength !== 'number' ||
        !Array.isArray(parsed.captions) ||
        parsed.captions.length === 0
      ) {
        this.logger.warn('Viral optimizer: unexpected response shape, falling back');
        return null;
      }

      this.logger.log(
        `Viral optimizer: hook_strength=${parsed.hook_strength}, captions=${parsed.captions.length}`,
      );
      return parsed;
    } catch (err) {
      this.logger.warn(`Viral optimizer failed: ${err?.message ?? err} — falling back to heuristic splitting`);
      return null;
    }
  }
}
