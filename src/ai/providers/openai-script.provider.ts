import { Injectable } from '@nestjs/common';
import { IScriptGenerator, ScriptJSON } from '../interfaces/script-generator.interface';
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

  async generateScriptJSON(topic: string): Promise<ScriptJSON> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }

    const systemPrompt = `You are a script writer for short-form video content (30-60 seconds). 
Create engaging, structured scripts for faceless reels with multiple scenes. 
Each scene should have:
- A clear visual description
- An image generation prompt (detailed, suitable for DALL-E)
- Duration in seconds
- Audio narration text

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "scene_number": 1,
      "description": "Brief scene description",
      "image_prompt": "Detailed prompt for image generation",
      "duration": 5,
      "audio_text": "Text to be spoken during this scene"
    }
  ],
  "total_duration": 30,
  "topic": "Topic name"
}

Create 3-6 scenes that total 30-60 seconds. Make it engaging and suitable for social media.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Create a structured script with scenes for a faceless reel about: ${topic}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const parsed = JSON.parse(content);
      // Validate and ensure proper structure
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        throw new Error('Invalid JSON structure: missing scenes array');
      }
      return parsed as ScriptJSON;
    } catch (error) {
      throw new Error(`Failed to parse script JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
