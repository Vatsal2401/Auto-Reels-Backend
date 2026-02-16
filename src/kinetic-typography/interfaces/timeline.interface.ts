/**
 * Timeline block shape shared by backend (script processor), worker (forward to Lambda), and Remotion composition.
 * Worker forwards JSON; no runtime dependency on this file.
 */
export interface TimelineBlock {
  text: string;
  words: string[];
  durationInFrames: number;
  animationPreset: string;
  highlightWordIndices?: number[];
}

export type SplitMode = 'sentence' | 'line';

export type AnimationIntensity = 'low' | 'medium' | 'high' | number;
