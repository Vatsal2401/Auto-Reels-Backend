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

export interface IScriptGenerator {
  generateScript(topic: string): Promise<string>;
  generateScriptJSON(topic: string): Promise<ScriptJSON>;
}
