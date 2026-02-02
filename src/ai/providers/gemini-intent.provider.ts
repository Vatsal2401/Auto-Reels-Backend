import { Injectable, Logger } from '@nestjs/common';
import { IIntentInterpreter, InterpretedIntent } from '../interfaces/intent-interpreter.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const systemPrompt = `You are an AI Creative Director for a high-end video generation system.
Your task is to take a short creative prompt from a user and expand it into detailed, tool-specific instructions.

RULES:
- Preserve the user's intent exactly.
- Expand it into detailed prompts for script, images, and audio.
- Ensure consistency across all outputs.
- Infer cinematic language automatically (lighting, camera angles, mood).
- Never ask the user for clarification.
- Never add unrelated concepts.
- Do NOT copy the user prompt verbatim.
- Do NOT copy the user prompt verbatim.
- Do NOT copy the user prompt verbatim.
- Keep all outputs aligned to the same mood and genre.

SAFETY & COMPLIANCE (CRITICAL):
- NO real-world celebrities or public figures (e.g. usage of names like "Ranveer", "Taylor Swift" is BANNED).
- NO copyrighted characters (e.g. "Spider-Man", "Mickey Mouse").
- NO explicit violence, gore, nudity, or sexual content.
- NO children in unsafe or inappropriate situations.
- If the user prompt asks for any of the above, TRANSFORM them into generic, safe alternatives (e.g. "a charismatic Bollywood superstar", "a superhero in a red suit").

USER PROMPT: "${userPrompt}"

Output ONLY valid JSON. Do not include markdown formatting or backticks.
Structure:
{
    "script_prompt": "Detailed system prompt for a script writer AI (Gemini Pro). Focus on the narrative structure, tone, and specific elements to include.",
    "image_prompt": "Detailed visual description of the SCENE and SUBJECT for an image generator (Gemini Image). MUST include a clear subject (person, place, object), action, setting, lighting, and artistic style. Avoid vague style-only descriptions.",
    "audio_prompt": "Instruction for a Text-to-Speech system (ElevenLabs). Describe the voice persona, pacing, and emotional delivery.",
    "caption_prompt": "Instruction for caption generation. Specify the style of captions (professional, energetic, minimalist).",
    "rendering_hints": {
        "mood": "Short description of the emotional tone",
        "pacing": "fast | moderate | slow",
        "visual_style": "e.g., cinematic, anime, minimalist, 3D render",
        "color_palette": ["List of 3-5 HEX colors or color names"],
        "music_vibe": "Description of the background music that should accompany this video"
    }
}`;

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
