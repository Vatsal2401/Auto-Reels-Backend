import { Injectable } from '@nestjs/common';
import type {
  ScenePlanScene,
  EnhancedScene,
  ToneCategory,
  LayoutType,
} from '../interfaces/graphic-motion.interface';

@Injectable()
export class SceneIntelligenceService {
  /**
   * Enrich each scene with words, energy, tone, visual weight, and optional suggested layout.
   * Rule-based; no ML. Tokenize same way as ScriptProcessorService.
   */
  enhance(scenes: ScenePlanScene[], globalTone: string): EnhancedScene[] {
    return scenes.map((s) => this.enhanceOne(s, globalTone));
  }

  private enhanceOne(scene: ScenePlanScene, globalTone: string): EnhancedScene {
    const words = this.tokenize(scene.text);
    const wordCount = words.length;
    const energyScore = this.energyScore(scene.emphasisLevel, scene.importanceScore, wordCount);
    const toneCategory = this.toneCategory(scene.sceneType, globalTone);
    const visualWeight = scene.importanceScore * 0.6 + scene.emphasisLevel * 0.4;
    const suggestedLayoutType = this.suggestLayout(wordCount, words, scene);

    return {
      text: scene.text,
      words,
      sceneType: scene.sceneType,
      emphasisLevel: scene.emphasisLevel,
      importanceScore: scene.importanceScore,
      energyScore,
      toneCategory,
      wordCount,
      visualWeight,
      suggestedLayoutType,
      suggestedTemplateType: scene.suggestedTemplateType,
      label: scene.label,
      subHeadline: scene.subHeadline,
      supportingText: scene.supportingText,
      authorLine: scene.authorLine,
      headlineEmphasis: scene.headlineEmphasis,
    };
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
  }

  private energyScore(emphasisLevel: number, importanceScore: number, wordCount: number): number {
    const term = 0.4 * emphasisLevel + 0.3 * (1 - 1 / (1 + wordCount / 5)) + 0.3 * importanceScore;
    return Math.max(0, Math.min(1, term));
  }

  private toneCategory(sceneType: ScenePlanScene['sceneType'], globalTone: string): ToneCategory {
    if (sceneType === 'cta') return 'urgent';
    if (sceneType === 'intro') return 'calm';
    if (sceneType === 'problem') {
      const t = globalTone.toLowerCase();
      return t.includes('urgent') ? 'urgent' : 'neutral';
    }
    const t = globalTone.toLowerCase();
    if (t.includes('celebrat') || t.includes('bold')) return 'celebratory';
    return 'neutral';
  }

  private suggestLayout(
    wordCount: number,
    words: string[],
    scene: ScenePlanScene,
  ): LayoutType | undefined {
    if (wordCount === 1 && words[0] && words[0].length <= 8) {
      return 'impact-single-word';
    }
    if (wordCount >= 8 || scene.text.length >= 50) {
      return 'split-stack';
    }
    return undefined;
  }
}
