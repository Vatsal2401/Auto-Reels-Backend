import { Injectable } from '@nestjs/common';
import type {
  EnhancedScene,
  MotionConfig,
  LayoutType,
} from '../interfaces/graphic-motion.interface';

const LAYOUT_ORDER: LayoutType[] = [
  'center-hero',
  'split-stack',
  'minimal-left',
  'impact-single-word',
  'graphic-accent',
];

@Injectable()
export class LayoutEngineService {
  /**
   * Assign layoutType per scene. No consecutive repetition; deterministic.
   */
  assignLayouts(enhancedScenes: EnhancedScene[], motionConfigs: MotionConfig[]): LayoutType[] {
    let previous: LayoutType | null = null;
    return enhancedScenes.map((scene, i) => {
      const layout = this.chooseLayout(scene, motionConfigs[i]!, i, previous);
      previous = layout;
      return layout;
    });
  }

  private chooseLayout(
    scene: EnhancedScene,
    _motionConfig: MotionConfig,
    sceneIndex: number,
    previous: LayoutType | null,
  ): LayoutType {
    let choice: LayoutType;
    if (scene.suggestedLayoutType) {
      choice = scene.suggestedLayoutType;
    } else if (scene.wordCount === 1 && scene.words[0] && scene.words[0].length <= 8) {
      choice = 'impact-single-word';
    } else if (scene.wordCount >= 6 || scene.text.length >= 50) {
      choice = 'split-stack';
    } else if (scene.sceneType === 'cta' || (scene.importanceScore > 0.8 && sceneIndex % 2 === 0)) {
      choice = 'graphic-accent';
    } else {
      choice = sceneIndex % 2 === 0 ? 'center-hero' : 'minimal-left';
    }
    if (previous !== null && choice === previous) {
      const idx = LAYOUT_ORDER.indexOf(choice);
      choice = LAYOUT_ORDER[(idx + 1) % LAYOUT_ORDER.length]!;
    }
    return choice;
  }
}
