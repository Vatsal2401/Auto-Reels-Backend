/**
 * Graphic Motion Engine — payload and engine types.
 * Shared by backend (build payload), worker (forward), and Remotion (render).
 */

export type SceneType = 'intro' | 'problem' | 'feature' | 'cta';
export type VisualTreatment = 'minimal' | 'bold' | 'kinetic' | 'calm';

/**
 * Per-scene fields optimized for Remotion graphic motion templates.
 * When AI provides these, the engine uses them for labels, subheadlines, quotes, and template choice.
 */
export interface ScenePlanScene {
  text: string;
  sceneType: SceneType;
  emphasisLevel: number;
  importanceScore: number;
  visualTreatment?: VisualTreatment;
  /** Short uppercase label (e.g. "INTRODUCTION", "FEATURE"). Used by title-card / feature-highlight. */
  label?: string;
  /** One line under main headline. Used by title-card. */
  subHeadline?: string;
  /** Supporting description. Used by feature-highlight. */
  supportingText?: string;
  /** Author or attribution. Used by quote-card. */
  authorLine?: string;
  /** Hint for which template fits best. Engine may override to avoid repetition. */
  suggestedTemplateType?: TemplateType;
  /** Optional. When "high", headline gets strongest color; "medium" can be used for softer emphasis. */
  headlineEmphasis?: 'high' | 'medium';
}

export interface ScenePlan {
  videoStyle: string;
  globalTone: string;
  /** Optional. Preferred scene length: "short" (2-3s), "medium" (4-5s), "long" (5-7s), or a number (seconds). Rhythm engine uses when mapping to targetSecondsPerScene. */
  preferredSceneLength?: string | number;
  scenes: ScenePlanScene[];
}

export type LayoutType =
  | 'center-hero'
  | 'split-stack'
  | 'minimal-left'
  | 'impact-single-word'
  | 'graphic-accent';

/** Structured template types (Canva-style). Each has distinct hierarchy and layout. */
export type TemplateType = 'title-card' | 'quote-card' | 'feature-highlight' | 'impact-full-bleed';

/** Style preset applied consistently across the whole video. */
export type TemplateStyle = 'minimal' | 'bold' | 'corporate';

/** Optional three-level text colors (headline, subhead, label). When set, Remotion uses these instead of deriving from background. */
export interface TextColorHierarchy {
  headline: string;
  subhead: string;
  label: string;
}

export interface TemplateStyleConfig {
  background: {
    type: 'flat-light' | 'flat-dark' | 'gradient-soft';
    primary: string;
    secondary?: string;
  };
  typography: {
    fontScaleMultiplier: number;
    headlineWeight: number;
    /** Optional framework-style tokens (px). Remotion can use for hero/large/body hierarchy. */
    fontHeroSize?: number;
    fontBodySize?: number;
  };
  motion: {
    intensity: number;
  };
  accent: {
    color: string;
    showBar: boolean;
  };
  /** Optional. When set, Remotion uses this hierarchy instead of deriving from background type. */
  textColors?: TextColorHierarchy;
}

export type ToneCategory = 'calm' | 'urgent' | 'neutral' | 'celebratory';

export interface EnhancedScene {
  text: string;
  words: string[];
  sceneType: SceneType;
  emphasisLevel: number;
  importanceScore: number;
  energyScore: number;
  toneCategory: ToneCategory;
  wordCount: number;
  visualWeight: number;
  suggestedLayoutType?: LayoutType;
  suggestedTemplateType?: TemplateType;
  /** From AI or rule-based. Used by Remotion title-card / feature-highlight. */
  label?: string;
  subHeadline?: string;
  supportingText?: string;
  authorLine?: string;
  /** Optional. From AI: "high" | "medium". Templates use for headline emphasis. */
  headlineEmphasis?: 'high' | 'medium';
}

export type MotionPreset = 'premium-ease' | 'minimal' | 'emphasis';
export type EntryStyle = 'stagger-up' | 'fade' | 'mask-reveal';

export interface MotionConfig {
  motionPreset: MotionPreset;
  entryStyle: EntryStyle;
  motionIntensity: number;
  depthLevel: number;
}

export interface SceneRhythm {
  entryFrames: number;
  holdFrames: number;
  exitFrames: number;
  totalFrames: number;
}

export type TransitionType = 'fade' | 'slide-up' | 'mask-wipe' | 'zoom';

export interface TransitionSpec {
  transitionType: TransitionType;
  transitionDuration: number;
}

export interface GraphicMotionScene {
  text: string;
  words: string[];
  /** @deprecated Prefer templateType. Kept for backward compat. */
  layoutType: LayoutType;
  templateType: TemplateType;
  motionConfig: MotionConfig;
  rhythm: SceneRhythm;
  transitionIn: TransitionSpec;
  highlightWordIndices?: number[];
  /** Small label above headline (e.g. "INTRODUCTION") */
  label?: string;
  /** Subheadline below headline */
  subHeadline?: string;
  supportingText?: string;
  /** Author or attribution (quote-card) */
  authorLine?: string;
  tags?: string[];
  lines?: string[];
  lineColors?: string[];
  accentColor?: string;
  /** Optional. From AI: "high" | "medium". Templates can use for headline vs support color emphasis. */
  headlineEmphasis?: 'high' | 'medium';
}

export interface GraphicMotionTimeline {
  width: number;
  height: number;
  fps: number;
  fontFamily?: string;
  videoStyle?: string;
  globalTone?: string;
  templateStyle: TemplateStyle;
  styleConfig: TemplateStyleConfig;
  format?: 'reels' | 'tiktok' | 'horizontal' | 'square';
  brandAssetUrl?: string;
  /** Optional. Target seconds per scene (framework SCENE_CHANGE_TIME). Rhythm engine uses when provided. */
  targetSecondsPerScene?: number;
  /** Optional. Minimum hold seconds per scene. Rhythm engine uses when provided. */
  minHoldSeconds?: number;
  scenes: GraphicMotionScene[];
}
