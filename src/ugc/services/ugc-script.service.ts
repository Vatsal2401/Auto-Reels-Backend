import { Injectable, Logger } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { UgcScriptSchema } from '../../langchain/schemas/ugc-script.schema';
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

  private readonly chain = ChatPromptTemplate.fromMessages([
    ['system', '{systemPrompt}'],
    ['human', '{userPrompt}'],
  ]).pipe(this.registry.getStructuredGemini(UgcScriptSchema));

  constructor(private readonly registry: LangChainRegistry) {}

  async generateScript(params: {
    productName: string;
    productDescription: string;
    benefits: string[];
    targetAudience: string;
    callToAction: string;
    ugcStyle: string;
  }): Promise<UgcScriptJSON> {
    const { systemPrompt, userPrompt } = buildUgcScriptPrompt(params);

    this.logger.log(`Generating UGC script for product: ${params.productName}`);

    let script: UgcScriptJSON;
    try {
      script = await this.chain.invoke({ systemPrompt, userPrompt });
    } catch (err) {
      this.logger.error(`Failed to generate UGC script: ${err?.message ?? err}`);
      throw new Error(`Failed to generate UGC script from Gemini: ${err?.message ?? err}`);
    }

    // Post-process: convert "" → null for actor_script/broll_query (Gemini can't return null directly)
    for (const scene of script.scenes) {
      if (scene.actor_script === '') scene.actor_script = null;
      if (scene.broll_query === '') scene.broll_query = null;
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
