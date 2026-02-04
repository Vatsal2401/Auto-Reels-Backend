import { Injectable, Logger } from '@nestjs/common';
import {
  IScriptGenerator,
  ScriptJSON,
  ScriptGenerationOptions,
} from '../interfaces/script-generator.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getScriptGenerationPrompt, getSimpleScriptPrompt } from '../prompts/script-prompts';

@Injectable()
export class GeminiScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(GeminiScriptProvider.name);
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

  async generateScript(topic: string): Promise<string> {
    if (!this.model) throw new Error('Gemini API key missing');
    const prompt = getSimpleScriptPrompt(topic);
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON> {
    if (!this.model) throw new Error('Gemini API key missing');

    let topic: string;
    let language = 'English (US)';
    let duration = 30;
    let audioStyle = '';
    let visualStyle = 'Cinematic';

    if (typeof optionsOrTopic === 'string') {
      topic = optionsOrTopic;
    } else {
      topic = optionsOrTopic.topic;
      language = optionsOrTopic.language || 'English (US)';
      if (optionsOrTopic.targetDurationSeconds) {
        duration = optionsOrTopic.targetDurationSeconds;
      }
      audioStyle = optionsOrTopic.audioPrompt || '';
      // EXTRACT VISUAL STYLE IF PASSED IN
      visualStyle = (optionsOrTopic as any).visualStyle || 'Cinematic';
    }

    const prompt = getScriptGenerationPrompt(topic, duration, language, audioStyle, visualStyle);

    this.logger.debug(
      `Generating script with topic: ${topic}, duration: ${duration}, style: ${visualStyle}`,
    );

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response
      .text()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(text);
    } catch (e) {
      this.logger.error('Failed to parse Gemini JSON', text);
      throw new Error('Invalid JSON from Gemini: ' + e.message);
    }
  }
}
