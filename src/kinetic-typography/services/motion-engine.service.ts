import { Injectable } from '@nestjs/common';
import type {
  EnhancedScene,
  MotionConfig,
  MotionPreset,
  EntryStyle,
} from '../interfaces/graphic-motion.interface';

const PRESET_ORDER: MotionPreset[] = ['premium-ease', 'minimal', 'emphasis'];

@Injectable()
export class MotionEngineService {
  /**
   * Assign motion preset, entry style, intensity, depth per scene.
   * Deterministic: no random; avoid consecutive same preset.
   */
  buildMotionConfigs(enhancedScenes: EnhancedScene[]): MotionConfig[] {
    let previousPreset: MotionPreset | null = null;
    return enhancedScenes.map((scene, sceneIndex) => {
      const config = this.configForScene(scene, sceneIndex, previousPreset);
      previousPreset = config.motionPreset;
      return config;
    });
  }

  private configForScene(
    scene: EnhancedScene,
    sceneIndex: number,
    previousPreset: MotionPreset | null,
  ): MotionConfig {
    const score = scene.importanceScore + scene.energyScore + sceneIndex * 0.01;
    let preset: MotionPreset;
    if (score >= 1.4) preset = 'emphasis';
    else if (score <= 0.8) preset = 'minimal';
    else preset = 'premium-ease';
    if (previousPreset !== null && preset === previousPreset) {
      const i = PRESET_ORDER.indexOf(preset);
      preset = PRESET_ORDER[(i + 1) % PRESET_ORDER.length]!;
    }
    const entryStyle: EntryStyle = scene.sceneType === 'cta' ? 'fade' : 'stagger-up';
    const motionIntensity = Math.max(
      0,
      Math.min(1, 0.6 * scene.energyScore + 0.4 * scene.emphasisLevel),
    );
    const depthLevel = 0;
    return {
      motionPreset: preset,
      entryStyle,
      motionIntensity,
      depthLevel,
    };
  }
}
