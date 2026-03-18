import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildUgcScriptPrompt } from '../prompts/ugc-script.prompt';

export interface UgcScene {
  scene_number: number;
  type: 'selfie_talk' | 'broll_cutaway' | 'product_close' | 'reaction' | 'text_overlay';
  duration_seconds: number;
  actor_script: string | null;
  broll_query: string | null;
  caption_text: string;
  emotion: 'excited' | 'genuine' | 'concerned' | 'amazed' | 'confident';
  start_time_seconds: number;
}

export interface UgcScriptJSON {
  hook: string;
  hook_type: 'question' | 'claim' | 'story' | 'shock';
  hook_strength: number;
  hook_variations: string[];
  scenes: UgcScene[];
  voiceover_text: string;
  total_duration_seconds: number;
  hashtag_suggestions: string[];
}

@Injectable()
export class UgcScriptService {
  private readonly logger = new Logger(UgcScriptService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateScript(params: {
    productName: string;
    productDescription: string;
    benefits: string[];
    targetAudience: string;
    callToAction: string;
    ugcStyle: string;
  }): Promise<UgcScriptJSON> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const { systemPrompt, userPrompt } = buildUgcScriptPrompt(params);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    this.logger.log(`Generating UGC script for product: ${params.productName}`);

    const result = await model.generateContent(userPrompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonText = text
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/[\u0000-\u001F\u007F]/g, '');

    let script: UgcScriptJSON;
    try {
      script = JSON.parse(jsonText);
    } catch {
      this.logger.error(`Failed to parse Gemini UGC script response: ${text.slice(0, 300)}`);
      throw new Error('Failed to parse UGC script from Gemini');
    }

    // Compute start_time_seconds for each scene
    let elapsed = 0;
    for (const scene of script.scenes) {
      scene.start_time_seconds = elapsed;
      elapsed += scene.duration_seconds;
    }
    script.total_duration_seconds = elapsed;

    // Ensure voiceover_text is the concatenation of all actor scripts
    if (!script.voiceover_text) {
      script.voiceover_text = script.scenes
        .filter((s) => s.actor_script)
        .map((s) => s.actor_script)
        .join(' ');
    }

    this.logger.log(
      `UGC script generated: ${script.scenes.length} scenes, ${script.total_duration_seconds}s, hook_strength=${script.hook_strength}`,
    );

    return script;
  }
}
