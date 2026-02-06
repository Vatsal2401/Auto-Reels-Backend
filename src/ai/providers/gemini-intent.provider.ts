import { Injectable, Logger } from '@nestjs/common';
import { IIntentInterpreter, InterpretedIntent } from '../interfaces/intent-interpreter.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getIntentSystemPrompt } from '../prompts/intent-prompts';

@Injectable()
export class GeminiIntentProvider implements IIntentInterpreter {
  private readonly logger = new Logger(GeminiIntentProvider.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  }

  async interpretIntent(userPrompt: string): Promise<InterpretedIntent> {
    if (!this.model) throw new Error('Gemini API key missing');

    const systemPrompt = getIntentSystemPrompt(userPrompt);

    const result = await this.model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response
      .text()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      this.logger.error('Failed to parse Gemini Intent JSON', text);
      throw new Error('Invalid JSON from Gemini Intent: ' + e.message);
    }
  }
}
