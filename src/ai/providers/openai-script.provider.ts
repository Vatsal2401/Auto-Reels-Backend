import { Injectable, Logger } from '@nestjs/common';
import {
  IScriptGenerator,
  ScriptJSON,
  ScriptGenerationOptions,
} from '../interfaces/script-generator.interface';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { ScriptJSONSchema } from '../../langchain/schemas/script.schema';
import {
  getOpenAIScriptSystemPrompt,
  getOpenAISimpleScriptPrompt,
} from '../prompts/script-prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class OpenAIScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(OpenAIScriptProvider.name);

  constructor(private readonly registry: LangChainRegistry) {}

  async generateScript(topic: string): Promise<string> {
    const promptTemplate = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a script writer for short-form video content. Create engaging, high-retention scripts.',
      ],
      ['human', '{userPrompt}'],
    ]);

    const chain = promptTemplate.pipe(this.registry.getOpenAI()).pipe(new StringOutputParser());

    try {
      return await chain.invoke({ userPrompt: getOpenAISimpleScriptPrompt(topic) });
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
    let duration: string | number = '30-60';
    let visualStyle = 'Cinematic';
    let audioStyle = '';
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
      visualStyle = optionsOrTopic.visualStyle || 'Cinematic';
      audioStyle = optionsOrTopic.audioPrompt || '';
      tone = optionsOrTopic.tone;
      hookType = optionsOrTopic.hookType;
      cta = optionsOrTopic.cta;
    }

    const systemPrompt = getOpenAIScriptSystemPrompt(
      duration,
      language,
      visualStyle,
      audioStyle,
      tone,
      hookType,
      cta,
    );

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', '{systemPrompt}'],
      ['human', '{userMessage}'],
    ]);

    const chain = promptTemplate.pipe(this.registry.getStructuredOpenAI(ScriptJSONSchema));

    try {
      const result = await chain.invoke({
        systemPrompt,
        userMessage: `Create a viral reel script for: "${topic}". Apply ${visualStyle} visual style throughout all scene image prompts.`,
      });
      return result as ScriptJSON;
    } catch (err) {
      this.logger.error(
        `generateScriptJSON.error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
