import { Injectable, Logger } from '@nestjs/common';
import { IScriptGenerator, ScriptJSON } from '../interfaces/script-generator.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

        const prompt = `Write a short 30-second video script about: "${topic}". 
    Format it as a sequence of scenes with visual descriptions and narration.`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async generateScriptJSON(topic: string): Promise<ScriptJSON> {
        if (!this.model) throw new Error('Gemini API key missing');

        const prompt = `You are a professional video script writer.
Create a 30-second video script about: "${topic}".
Output ONLY valid JSON. Do not include any markdown formatting, backticks, or code blocks. Just the raw JSON object.
Structure:
{
  "topic": "${topic}",
  "total_duration": 30,
  "scenes": [
    {
      "scene_number": 1,
      "description": "Visual description of the scene",
      "image_prompt": "Detailed AI image generation prompt for this scene",
      "duration": 5,
      "audio_text": "Narration text for this scene (approx 15-20 words)"
    }
  ]
}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(text);
        } catch (e) {
            this.logger.error('Failed to parse Gemini JSON', text);
            throw new Error('Invalid JSON from Gemini: ' + e.message);
        }
    }
}
