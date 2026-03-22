import { z } from 'zod';

// Strict enums mirroring interface types — replaces all normalize*() methods in ScenePlannerService

const SceneTypeEnum = z.enum(['intro', 'problem', 'feature', 'cta']);

const TemplateTypeEnum = z.enum([
  'title-card',
  'quote-card',
  'feature-highlight',
  'impact-full-bleed',
  'stats-card',
  'steps-card',
  'split-accent',
  'countdown-badge',
]);

const BackgroundTypeEnum = z.enum([
  'flat-light',
  'flat-dark',
  'gradient-soft',
  'animated-gradient',
  'dot-grid',
  'geometric-lines',
  'noise-texture',
  'radial-glow',
]);

const HeadlineEmphasisEnum = z.enum(['high', 'medium']);

// Mirrors ScenePlanScene interface
export const ScenePlanSceneSchema = z.object({
  text: z.string(),
  sceneType: SceneTypeEnum,
  emphasisLevel: z.number().min(0).max(1),
  importanceScore: z.number().min(0).max(1),
  label: z.string().optional(),
  subHeadline: z.string().optional(),
  supportingText: z.string().optional(),
  authorLine: z.string().optional(),
  suggestedTemplateType: TemplateTypeEnum.optional(),
  headlineEmphasis: HeadlineEmphasisEnum.optional(),
  backgroundType: BackgroundTypeEnum.optional(),
  highlightWords: z.array(z.string()).max(2).optional(),
  iconSuggestion: z.string().optional(),
});

// Mirrors ScenePlan interface
export const ScenePlanSchema = z.object({
  videoStyle: z.string(),
  globalTone: z.string(),
  preferredSceneLength: z.union([z.string(), z.number()]).optional(),
  scenes: z.array(ScenePlanSceneSchema).min(1),
});

export type ScenePlanOutput = z.infer<typeof ScenePlanSchema>;
