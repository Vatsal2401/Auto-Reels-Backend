import { z } from 'zod';

// Mirrors InterpretedIntent interface exactly
export const IntentSchema = z.object({
  script_prompt: z.string(),
  image_prompt: z.string(),
  audio_prompt: z.string(),
  caption_prompt: z.string(),
  rendering_hints: z.object({
    mood: z.string(),
    pacing: z.string(),
    visual_style: z.string(),
    color_palette: z.array(z.string()).optional(),
    music_vibe: z.string().optional(),
    motion_preset: z.string().optional(),
    motion_presets: z.array(z.string()).optional(),
    motion_emotion: z.string().optional(),
    pacing_style: z.enum(['smooth', 'rhythmic', 'viral', 'dramatic']).optional(),
  }),
});

export type IntentOutput = z.infer<typeof IntentSchema>;
