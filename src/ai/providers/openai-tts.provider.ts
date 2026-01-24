import { Injectable } from '@nestjs/common';
import { ITextToSpeech } from '../interfaces/text-to-speech.interface';
import OpenAI from 'openai';

@Injectable()
export class OpenAITTSProvider implements ITextToSpeech {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim()) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('Warning: OPENAI_API_KEY not set. TTS will fail at runtime.');
    }
  }

  async textToSpeech(text: string): Promise<Buffer> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
