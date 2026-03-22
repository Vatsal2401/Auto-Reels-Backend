import { z } from 'zod';

// Mirrors UgcScene interface exactly
// NOTE: Gemini rejects nullable types — actor_script/broll_query use empty string "" for "not applicable"
export const UgcSceneSchema = z.object({
  scene_number: z.number(),
  type: z.enum(['selfie_talk', 'broll_cutaway', 'product_close', 'reaction', 'text_overlay']),
  duration_seconds: z.number(),
  actor_script: z
    .string()
    .describe('The spoken script for the actor. Use empty string if not a talking scene.'),
  broll_query: z
    .string()
    .describe('Search query for B-roll footage. Use empty string if not a B-roll scene.'),
  caption_text: z.string(),
  emotion: z.enum(['excited', 'genuine', 'concerned', 'amazed', 'confident']),
  start_time_seconds: z.number(),
});

// Mirrors UgcScriptJSON interface exactly
export const UgcScriptSchema = z.object({
  hook: z.string(),
  hook_type: z.enum(['question', 'claim', 'story', 'shock']),
  hook_strength: z.number(),
  hook_variations: z.array(z.string()),
  scenes: z.array(UgcSceneSchema),
  voiceover_text: z.string(),
  total_duration_seconds: z.number(),
  hashtag_suggestions: z.array(z.string()),
});

export type UgcScriptOutput = z.infer<typeof UgcScriptSchema>;
