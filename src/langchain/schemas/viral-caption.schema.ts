import { z } from 'zod';

// Mirrors ViralCaptionLine interface exactly
// NOTE: Gemini rejects nullable types (["string","null"]) — highlight uses empty string "" for "no highlight"
// The service converts "" → null after invoke()
export const ViralCaptionLineSchema = z.object({
  line: z.string(),
  highlight: z
    .string()
    .describe('The most emotionally charged word to highlight. Use empty string if no word stands out.'),
  intensity: z.number().int().min(1).max(5),
});

// Mirrors ViralCaptionResult interface exactly
export const ViralCaptionSchema = z.object({
  hook_strength: z.number().min(1).max(10),
  captions: z.array(ViralCaptionLineSchema).min(1),
});

export type ViralCaptionOutput = z.infer<typeof ViralCaptionSchema>;
