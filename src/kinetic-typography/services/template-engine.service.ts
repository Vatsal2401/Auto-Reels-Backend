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
];

@Injectable()
export class TemplateEngineService {
  /**
   * Assign templateType per scene. No consecutive repetition; deterministic.
   * Each template has distinct typography hierarchy and layout structure.
   */
  assignTemplates(
    enhancedScenes: EnhancedScene[],
    motionConfigs: MotionConfig[],
  ): TemplateType[] {
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
    } else if (scene.wordCount === 1 && scene.words[0] && scene.words[0].length <= 10) {
      choice = 'impact-full-bleed';
    } else if (scene.sceneType === 'cta' && scene.wordCount <= 4) {
      choice = 'impact-full-bleed';
    } else if (scene.wordCount >= 8 || scene.text.length >= 60) {
      choice = 'quote-card';
    } else if (scene.sceneType === 'feature' || scene.sceneType === 'problem') {
      choice = 'feature-highlight';
    } else {
      choice = sceneIndex === 0 ? 'title-card' : 'feature-highlight';
    }
    if (previous !== null && choice === previous) {
      const idx = TEMPLATE_ORDER.indexOf(choice);
      choice = TEMPLATE_ORDER[(idx + 1) % TEMPLATE_ORDER.length]!;
    }
    return choice;
  }
}
