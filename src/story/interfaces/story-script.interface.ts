export type StoryGenre = 'horror' | 'motivational' | 'crime' | 'urban_legend' | 'comedy';
export type CameraMotion = 'zoom_in' | 'slow_pan' | 'parallax' | 'camera_shake' | 'fade_out';

export interface StoryCharacter {
  name: string;
  appearance: string;
  clothing: string;
  style: string;
  consistency_anchor: string;
}

export interface StoryScene {
  scene_number: number;
  description: string;
  image_prompt: string;
  subtitle: string;
  narration: string;
  camera_motion: CameraMotion;
  duration_seconds: number;
  start_time_seconds: number;
}

export interface StoryScriptJSON {
  title: string;
  genre: StoryGenre;
  characters: StoryCharacter[];
  scenes: StoryScene[];
  visual_style: string;
  audio_mood: string;
  total_duration_seconds: number;
}
