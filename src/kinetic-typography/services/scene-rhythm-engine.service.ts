import { Injectable } from '@nestjs/common';
import type { EnhancedScene, SceneRhythm } from '../interfaces/graphic-motion.interface';

const FPS = 30;
const BASE_FRAMES_PER_WORD = 18;
const MIN_HOLD_FRAMES = Math.round(0.8 * FPS); // 0.8s min hold so text doesn't change too quickly
const MIN_TOTAL_FRAMES_PER_SCENE = 60; // ~2s minimum per scene
const ENTRY_PCT = 0.28;
const EXIT_PCT = 0.14;
const EXIT_PCT_CTA = 0.18;

/** Deterministic hash to [0,1] for ±5% variation. */
function seededHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

@Injectable()
export class SceneRhythmEngineService {
  /**
   * Allocate entry/hold/exit frames per scene. Phase-aware; CTA gets slightly longer exit.
   * Deterministic: optional ±5% via projectId + sceneIndex seed.
   */
  allocate(
    enhancedScenes: EnhancedScene[],
    options: {
      fps?: number;
      projectId?: string;
      totalTargetSeconds?: number;
      /** Optional. Target seconds per scene (framework pacing). When set, drives totalFrames per scene. */
      targetSecondsPerScene?: number;
      /** Optional. Minimum hold seconds per scene. Overrides default MIN_HOLD_FRAMES when set. */
      minHoldSeconds?: number;
    } = {},
  ): SceneRhythm[] {
    const fps = options.fps ?? FPS;
    const projectId = options.projectId ?? '';
    const targetFramesPerScene = options.targetSecondsPerScene != null
      ? Math.round(options.targetSecondsPerScene * fps)
      : null;
    const minHoldFrames = options.minHoldSeconds != null
      ? Math.round(options.minHoldSeconds * fps)
      : MIN_HOLD_FRAMES;

    const totalScenes = enhancedScenes.length;
    return enhancedScenes.map((scene, sceneIndex) => {
      const baseFrames = targetFramesPerScene ?? this.baseFrames(scene, fps);
      const importanceMultiplier = targetFramesPerScene ? 1 : 0.9 + 0.2 * scene.importanceScore;
      let totalFrames = Math.round(baseFrames * importanceMultiplier);
      totalFrames = Math.max(MIN_TOTAL_FRAMES_PER_SCENE, Math.max(fps, Math.min(300, totalFrames)));
      const isLastScene = sceneIndex === totalScenes - 1;
      if (isLastScene && totalScenes > 1) {
        totalFrames = Math.min(300, Math.round(totalFrames * 1.1));
      }

      const isCta = scene.sceneType === 'cta';
      let entryPct = ENTRY_PCT;
      let exitPct = isCta ? EXIT_PCT_CTA : EXIT_PCT;
      const seed = `${projectId}-${sceneIndex}`;
      entryPct *= 0.98 + 0.04 * seededHash(seed);
      exitPct *= 0.95 + 0.1 * seededHash(seed + 'e');

      let entryFrames = Math.max(10, Math.floor(totalFrames * entryPct));
      let exitFrames = Math.max(8, Math.floor(totalFrames * exitPct));
      let holdFrames = totalFrames - entryFrames - exitFrames;
      if (holdFrames < minHoldFrames) {
        holdFrames = minHoldFrames;
        totalFrames = entryFrames + holdFrames + exitFrames;
      }
      return {
        entryFrames,
        holdFrames,
        exitFrames,
        totalFrames,
      };
    });
  }

  private baseFrames(scene: EnhancedScene, fps: number): number {
    const wordCount = Math.max(1, scene.wordCount);
    const intensity = 0.7 + 0.3 * (1 - scene.energyScore);
    return Math.round(wordCount * BASE_FRAMES_PER_WORD * intensity);
  }
}
