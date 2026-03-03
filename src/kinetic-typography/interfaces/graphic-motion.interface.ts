/**
 * Graphic Motion Engine — payload and engine types.
 * Shared by backend (build payload), worker (forward), and Remotion (render).
 */

export type SceneType = 'intro' | 'problem' | 'feature' | 'cta';
export type VisualTreatment = 'minimal' | 'bold' | 'kinetic' | 'calm';

export type BackgroundType =
  | 'flat-light'
  | 'flat-dark'
  | 'gradient-soft'
  | 'animated-gradient'
  | 'dot-grid'
  | 'geometric-lines'
  | 'noise-texture'
  | 'radial-glow'
  | 'crosshatch-grid';

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
  /** AI-suggested background type for this scene based on tone. */
  backgroundType?: BackgroundType;
  /** 1–2 power words to highlight in accent color. */
  highlightWords?: string[];
  /** Emoji or keyword for future icon/shape overlay. */
  iconSuggestion?: string;
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

/** Structured template types (Canva-style). Each has distinct hierarchy and layout structure. */
export type TemplateType =
  | 'title-card'
  | 'quote-card'
  | 'feature-highlight'
  | 'impact-full-bleed'
  | 'stats-card'
  | 'steps-card'
  | 'split-accent'
  | 'countdown-badge'
  | 'hero-split';

/** Style preset applied consistently across the whole video. */
export type TemplateStyle =
  | 'minimal'
  | 'bold'
  | 'corporate'
  | 'neon'
  | 'editorial'
  | 'gradient-pop'
  | 'dark-luxury'
  | 'pastel-soft';

export type TransitionType =
  | 'fade'
  | 'slide-up'
  | 'mask-wipe'
  | 'zoom'
  | 'glitch'
  | 'blur-sweep'
  | 'diagonal-wipe'
  | 'letter-blur';

/** Optional three-level text colors (headline, subhead, label). When set, Remotion uses these instead of deriving from background. */
export interface TextColorHierarchy {
  headline: string;
  subhead: string;
  label: string;
}

/** A single decorative SVG shape for the icon overlay system. */
export interface DecorativeShape {
  shape: 'circle' | 'triangle' | 'diamond' | 'star' | 'cross';
  cx: number;
  cy: number;
  size: number;
  /** Optional external icon URL. When set, renders <img> instead of SVG primitive. */
  iconUrl?: string;
  /** When true, renders an OrbitalRing ellipse around this shape. */
  hasOrbit?: boolean;
}

export interface TemplateStyleConfig {
  background: {
    type: BackgroundType;
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
    /** Glow intensity (0–1). Remotion derives glowPx = glowIntensity × 24. */
    glowIntensity?: number;
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
  /** AI-suggested or rule-derived background type for this scene. */
  backgroundType?: BackgroundType;
  /** 1–2 power words to highlight in accent color. */
  highlightWords?: string[];
  /** Emoji or keyword for icon/shape overlay generation. */
  iconSuggestion?: string;
  /** Multi-line structured content (e.g. step list). Used by steps-card and quote-card routing. */
  lines?: string[];
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
  /** For stats-card: the large metric number/value to display. */
  statNumber?: string;
  /** For stats-card: the unit/label below the number. */
  statLabel?: string;
  /** For steps-card: array of step text strings (up to 3). Fallback to lines[]. */
  stepItems?: string[];
  /** 1–2 power words to render in accent color with underline animation. */
  highlightWords?: string[];
  /** Render headline as CSS gradient text (webkit). */
  gradientText?: boolean;
  /** Per-scene background type override. Overrides video-level background when set. */
  backgroundType?: BackgroundType;
  /** Decorative SVG shape overlays. */
  decorativeShapes?: DecorativeShape[];
  /** CTA label text for hero-split template (e.g. "Try Free"). */
  ctaLabel?: string;
  /** Asset URL for hero-split template left-column image. */
  assetUrl?: string;
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
