export interface ScriptScene {
  scene_number: number;
  description: string;
  image_prompt: string;
  duration: number;
  audio_text: string;
}

export interface ScriptJSON {
  scenes: ScriptScene[];
  total_duration: number;
  topic: string;
  visual_style?: string;
  audio_mood?: string;
  caption_style?: string;
}

export interface ScriptGenerationOptions {
  topic: string;
  language?: string; // Default 'en-US'
  targetDurationSeconds?: number; // derived from '30-60'
  audioPrompt?: string; // Information about voice persona and pacing
  visualStyle?: string; // e.g. 'Cinematic', 'Minimalist', 'Anime', 'Dark'
}

export interface IScriptGenerator {
  generateScript(topic: string): Promise<string>;
  generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON>;
}
