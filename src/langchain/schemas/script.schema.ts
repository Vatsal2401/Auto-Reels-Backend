import { z } from 'zod';

// Mirrors ScriptScene interface exactly
export const ScriptSceneSchema = z.object({
  scene_number: z.number(),
  description: z.string(),
  image_prompt: z.string(),
  duration: z.number(),
  audio_text: z.string(),
});

// Mirrors ScriptJSON interface exactly
export const ScriptJSONSchema = z.object({
  scenes: z.array(ScriptSceneSchema),
  total_duration: z.number(),
  topic: z.string(),
  visual_style: z.string().optional(),
  audio_mood: z.string().optional(),
  caption_style: z.string().optional(),
});

export type ScriptJSONOutput = z.infer<typeof ScriptJSONSchema>;
