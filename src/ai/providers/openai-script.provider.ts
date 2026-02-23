import { Injectable } from '@nestjs/common';
import {
  IScriptGenerator,
  ScriptJSON,
  ScriptGenerationOptions,
} from '../interfaces/script-generator.interface';
import OpenAI from 'openai';
import {
  getOpenAIScriptSystemPrompt,
  getOpenAISimpleScriptPrompt,
} from '../prompts/script-prompts';

@Injectable()
export class OpenAIScriptProvider implements IScriptGenerator {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim()) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('Warning: OPENAI_API_KEY not set. Script generation will fail at runtime.');
    }
  }

  async generateScript(topic: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a script writer for short-form video content. Create engaging, high-retention scripts.',
        },
        {
          role: 'user',
          content: getOpenAISimpleScriptPrompt(topic),
        },
      ],
      temperature: 0.8,
    });

    return response.choices[0].message.content || '';
  }

  async generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }

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

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Create a viral reel script for: "${topic}". Apply ${visualStyle} visual style throughout all scene image prompts.`,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const parsed = JSON.parse(content);
      return parsed as ScriptJSON;
    } catch (error) {
      throw new Error(
        `Failed to parse script JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
