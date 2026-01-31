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
}

export interface ScriptGenerationOptions {
  topic: string;
  language?: string; // Default 'en-US'
  targetDurationSeconds?: number; // derived from '60-90'
}

export interface IScriptGenerator {
  generateScript(topic: string): Promise<string>;
  generateScriptJSON(optionsOrTopic: ScriptGenerationOptions | string): Promise<ScriptJSON>;
}
