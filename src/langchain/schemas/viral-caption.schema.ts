import { z } from 'zod';

// Mirrors ViralCaptionLine interface exactly
export const ViralCaptionLineSchema = z.object({
  line: z.string(),
  highlight: z.string().nullable(),
  intensity: z.number().int().min(1).max(5),
});

// Mirrors ViralCaptionResult interface exactly
export const ViralCaptionSchema = z.object({
  hook_strength: z.number().min(1).max(10),
  captions: z.array(ViralCaptionLineSchema).min(1),
});

export type ViralCaptionOutput = z.infer<typeof ViralCaptionSchema>;
