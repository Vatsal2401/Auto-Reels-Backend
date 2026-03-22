import { z } from 'zod';

// Mirrors StoryCharacter interface exactly
export const StoryCharacterSchema = z.object({
  name: z.string(),
  appearance: z.string(),
  clothing: z.string(),
  style: z.string(),
  consistency_anchor: z.string(),
});

// Mirrors StoryScene interface exactly
export const StorySceneSchema = z.object({
  scene_number: z.number(),
  description: z.string(),
  image_prompt: z.string(),
  subtitle: z.string(),
  narration: z.string(),
  camera_motion: z.enum(['zoom_in', 'slow_pan', 'parallax', 'camera_shake', 'fade_out']),
  duration_seconds: z.number(),
  start_time_seconds: z.number(),
});

// Mirrors StoryScriptJSON interface exactly
export const StoryScriptSchema = z.object({
  title: z.string(),
  genre: z.enum([
    'horror',
    'motivational',
    'crime',
    'urban_legend',
    'comedy',
    'sci_fi',
    'romance',
    'thriller',
    'historical',
    'documentary',
    'mystery',
  ]),
  characters: z.array(StoryCharacterSchema),
  scenes: z.array(StorySceneSchema),
  visual_style: z.string(),
  audio_mood: z.string(),
  total_duration_seconds: z.number(),
});

export type StoryScriptOutput = z.infer<typeof StoryScriptSchema>;
