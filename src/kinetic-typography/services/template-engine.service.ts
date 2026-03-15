import { Injectable } from '@nestjs/common';
import type {
  EnhancedScene,
  MotionConfig,
  TemplateType,
} from '../interfaces/graphic-motion.interface';

const TEMPLATE_ORDER: TemplateType[] = [
  'title-card',
  'quote-card',
  'feature-highlight',
  'impact-full-bleed',
  'stats-card',
  'steps-card',
  'split-accent',
  'countdown-badge',
  'hero-split',
];

/** Numeric pattern: text looks like a number with optional unit (e.g. "10x", "500+", "3.5"). */
function looksNumeric(text: string): boolean {
  return /^\s*[\d,]+[xX+%.]?[\d]*\s*\w{0,4}\s*$/.test(text.trim());
}

/** Short CTA-style pattern for countdown badge (e.g. "Day 1", "Step 3", "7 Days"). */
function looksLikeCta(text: string, wordCount: number): boolean {
  return wordCount <= 3 && /\d/.test(text);
}

@Injectable()
export class TemplateEngineService {
  /**
   * Assign templateType per scene. No consecutive repetition; deterministic.
   * Each template has distinct typography hierarchy and layout structure.
   */
  assignTemplates(enhancedScenes: EnhancedScene[], motionConfigs: MotionConfig[]): TemplateType[] {
    let previous: TemplateType | null = null;
    return enhancedScenes.map((scene, i) => {
      const template = this.chooseTemplate(scene, motionConfigs[i]!, i, previous);
      previous = template;
      return template;
    });
  }

  private chooseTemplate(
    scene: EnhancedScene,
    _motionConfig: MotionConfig,
    sceneIndex: number,
    previous: TemplateType | null,
  ): TemplateType {
    let choice: TemplateType;

    if (scene.suggestedTemplateType) {
      choice = scene.suggestedTemplateType;
    } else if (looksNumeric(scene.text) && scene.wordCount <= 4) {
      // Numeric/metric text → stats-card
      choice = 'stats-card';
    } else if (scene.wordCount === 1 && scene.words[0] && scene.words[0].length <= 10) {
      choice = 'impact-full-bleed';
    } else if (
      scene.sceneType === 'cta' &&
      scene.wordCount <= 4 &&
      looksLikeCta(scene.text, scene.wordCount)
    ) {
      // Short CTA with number → countdown-badge
      choice = 'countdown-badge';
    } else if (scene.sceneType === 'cta' && scene.wordCount <= 4) {
      choice = 'impact-full-bleed';
    } else if (scene.lines && scene.lines.length >= 2) {
      // Multi-line scenes → steps-card if sceneType is feature
      choice = scene.sceneType === 'feature' ? 'steps-card' : 'quote-card';
    } else if (scene.wordCount >= 8 || scene.text.length >= 60) {
      choice = 'quote-card';
    } else if (scene.sceneType === 'feature' || scene.sceneType === 'problem') {
      // Alternate between feature-highlight and split-accent for variety
      choice = sceneIndex % 2 === 0 ? 'feature-highlight' : 'split-accent';
    } else {
      choice = sceneIndex === 0 ? 'title-card' : 'feature-highlight';
    }

    if (previous !== null && choice === previous) {
      const idx = TEMPLATE_ORDER.indexOf(choice);
      // Only rotate within the first 4 (original) to keep quality high
      const rotationSet = TEMPLATE_ORDER.slice(0, 4);
      const idxInSet = rotationSet.indexOf(choice);
      if (idxInSet >= 0) {
        choice = rotationSet[(idxInSet + 1) % rotationSet.length]!;
      } else {
        choice = TEMPLATE_ORDER[(idx + 1) % TEMPLATE_ORDER.length]!;
      }
    }

    return choice;
  }
}
