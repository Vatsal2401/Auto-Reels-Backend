import { Injectable, Logger } from '@nestjs/common';
import {
  IScriptGenerator,
  ScriptJSON,
  ScriptGenerationOptions,
} from '../interfaces/script-generator.interface';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { ScriptJSONSchema } from '../../langchain/schemas/script.schema';
import { getScriptGenerationPrompt, getSimpleScriptPrompt } from '../prompts/script-prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { scriptJsonPromptTemplate, scriptSimplePromptTemplate } from './gemini-script.prompt';

@Injectable()
export class GeminiScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(GeminiScriptProvider.name);

  constructor(private readonly registry: LangChainRegistry) {}

  async generateScript(topic: string): Promise<string> {
    const prompt = getSimpleScriptPrompt(topic);
    const chain = scriptSimplePromptTemplate
      .pipe(this.registry.getGemini())
      .pipe(new StringOutputParser());

    try {
      return await chain.invoke({ prompt });
    } catch (err) {
      this.logger.error(
        `generateScript.error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON> {
    let topic: string;
    let language = 'English (US)';
    let duration = 30;
    let audioStyle = '';
    let visualStyle = 'Cinematic';
    let tone: string | undefined;
    let hookType: string | undefined;
    let cta: string | undefined;

    if (typeof optionsOrTopic === 'string') {
      topic = optionsOrTopic;
    } else {
      topic = optionsOrTopic.topic;
      language = optionsOrTopic.language || 'English (US)';
      if (optionsOrTopic.targetDurationSeconds) {
        duration = optionsOrTopic.targetDurationSeconds;
      }
      audioStyle = optionsOrTopic.audioPrompt || '';
      visualStyle = optionsOrTopic.visualStyle || 'Cinematic';
      tone = optionsOrTopic.tone;
      hookType = optionsOrTopic.hookType;
      cta = optionsOrTopic.cta;
    }

    const systemPrompt = getScriptGenerationPrompt(
      topic,
      duration,
      language,
      audioStyle,
      visualStyle,
      tone,
      hookType,
      cta,
    );

    const userMessage = `Create a viral reel script for: "${topic}". Apply ${visualStyle} visual style throughout all scene image prompts.`;

    this.logger.debug(
      `Generating script with topic: ${topic}, duration: ${duration}, style: ${visualStyle}`,
    );

    const chain = scriptJsonPromptTemplate.pipe(
      this.registry.getStructuredGemini(ScriptJSONSchema),
    );

    try {
      const result = await chain.invoke({ systemPrompt, userMessage });
      return result as ScriptJSON;
    } catch (err) {
      this.logger.error(
        `generateScriptJSON.error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
