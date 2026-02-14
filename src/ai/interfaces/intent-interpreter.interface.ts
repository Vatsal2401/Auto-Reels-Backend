export interface InterpretedIntent {
  script_prompt: string;
  image_prompt: string;
  audio_prompt: string;
  caption_prompt: string;
  rendering_hints: {
    mood: string;
    pacing: string;
    visual_style: string;
    color_palette?: string[];
    music_vibe?: string;
    motion_preset?: string;
    motion_presets?: string[];
    motion_emotion?: string;
    pacing_style?: 'smooth' | 'rhythmic' | 'viral' | 'dramatic';
  };
}

export interface IIntentInterpreter {
  interpretIntent(userPrompt: string): Promise<InterpretedIntent>;
}
