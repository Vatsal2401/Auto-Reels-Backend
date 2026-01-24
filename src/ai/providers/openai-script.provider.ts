import { Injectable } from '@nestjs/common';
import { IScriptGenerator } from '../interfaces/script-generator.interface';
import OpenAI from 'openai';

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
            'You are a script writer for short-form video content (30-60 seconds). Create engaging, concise scripts for faceless reels. Focus on hook, value, and call-to-action.',
        },
        {
          role: 'user',
          content: `Write a script for a faceless reel about: ${topic}. Keep it between 30-60 seconds when spoken. Make it engaging and suitable for social media.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  }
}
