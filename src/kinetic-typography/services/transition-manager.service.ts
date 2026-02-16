import { Injectable } from '@nestjs/common';
import type {
  TransitionSpec,
  TransitionType,
  LayoutType,
} from '../interfaces/graphic-motion.interface';

/** Three transition types. Rotate deterministically; avoid same transition twice in a row. */
const ROTATION_TYPES: TransitionType[] = ['fade', 'slide-up', 'mask-wipe'];
const DEFAULT_TRANSITION_DURATION = 10;

@Injectable()
export class TransitionManagerService {
  /**
   * Assign transitionIn for each scene. First scene: fade duration 0.
   * Rotate among fade, slide-up, mask-wipe. No two consecutive scenes get the same type.
   */
  assignTransitions(
    sceneCount: number,
    _layoutTypes: LayoutType[],
    options: { projectId?: string; fps?: number } = {},
  ): TransitionSpec[] {
    const projectId = options.projectId ?? '';
    const fps = options.fps ?? 30;
    const duration = Math.round(DEFAULT_TRANSITION_DURATION * (fps / 30));
    const seed = projectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const specs: TransitionSpec[] = [];

    for (let i = 0; i < sceneCount; i++) {
      if (i === 0) {
        specs.push({ transitionType: 'fade', transitionDuration: 0 });
        continue;
      }
      const prevType = specs[i - 1]!.transitionType;
      const rotationIndex = (i + Math.abs(seed)) % ROTATION_TYPES.length;
      let transitionType = ROTATION_TYPES[rotationIndex]!;
      if (transitionType === prevType) {
        transitionType = ROTATION_TYPES[(rotationIndex + 1) % ROTATION_TYPES.length]!;
      }
      specs.push({ transitionType, transitionDuration: duration });
    }
    return specs;
  }
}
