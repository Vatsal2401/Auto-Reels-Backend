import { Injectable } from '@nestjs/common';
import type {
  TransitionSpec,
  TransitionType,
  LayoutType,
  EnhancedScene,
} from '../interfaces/graphic-motion.interface';

/** Base rotation pool: original 3 transitions + zoom. */
const ROTATION_TYPES: TransitionType[] = ['fade', 'slide-up', 'mask-wipe', 'zoom'];

/** Premium transitions used for high-energy scenes (energyScore > 0.7). */
const PREMIUM_TRANSITIONS: TransitionType[] = ['glitch', 'letter-blur'];

/** Additional transitions available in the full pool. */
const EXTENDED_TRANSITIONS: TransitionType[] = ['blur-sweep', 'diagonal-wipe'];

const DEFAULT_TRANSITION_DURATION = 10;

@Injectable()
export class TransitionManagerService {
  /**
   * Assign transitionIn for each scene. First scene: fade duration 0.
   * Rotate among transition types. No two consecutive scenes get the same type.
   * High-energy scenes (energyScore > 0.7) may get premium transitions.
   */
  assignTransitions(
    sceneCount: number,
    _layoutTypes: LayoutType[],
    options: { projectId?: string; fps?: number; enhancedScenes?: EnhancedScene[] } = {},
  ): TransitionSpec[] {
    const projectId = options.projectId ?? '';
    const fps = options.fps ?? 30;
    const enhancedScenes = options.enhancedScenes ?? [];
    const duration = Math.round(DEFAULT_TRANSITION_DURATION * (fps / 30));
    const seed = projectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const specs: TransitionSpec[] = [];

    // Merge rotation pool: base + extended for variety
    const fullPool: TransitionType[] = [...ROTATION_TYPES, ...EXTENDED_TRANSITIONS];

    for (let i = 0; i < sceneCount; i++) {
      if (i === 0) {
        specs.push({ transitionType: 'fade', transitionDuration: 0 });
        continue;
      }

      const prevType = specs[i - 1]!.transitionType;
      const scene = enhancedScenes[i];
      const energyScore = scene?.energyScore ?? 0;

      // High-energy scenes get premium transitions
      if (energyScore > 0.7 && PREMIUM_TRANSITIONS.length > 0) {
        const premiumIdx = (i + Math.abs(seed)) % PREMIUM_TRANSITIONS.length;
        const premiumType = PREMIUM_TRANSITIONS[premiumIdx]!;
        if (premiumType !== prevType) {
          specs.push({ transitionType: premiumType, transitionDuration: duration });
          continue;
        }
      }

      const rotationIndex = (i + Math.abs(seed)) % fullPool.length;
      let transitionType = fullPool[rotationIndex]!;
      if (transitionType === prevType) {
        transitionType = fullPool[(rotationIndex + 1) % fullPool.length]!;
      }
      specs.push({ transitionType, transitionDuration: duration });
    }
    return specs;
  }
}
