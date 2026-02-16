import { Injectable } from '@nestjs/common';
import { TimelineBlock, AnimationIntensity } from './interfaces/timeline.interface';

const FPS = 30;
const BASE_FRAMES_PER_WORD = 15;
const MIN_FRAMES_PER_BLOCK = 30;
const MAX_FRAMES_PER_BLOCK = 300;

const INTENSITY_FACTOR: Record<string, number> = {
  low: 1.4,
  medium: 1.0,
  high: 0.7,
};

@Injectable()
export class DurationAllocatorService {
  /**
   * Fills durationInFrames for each block based on word count and animation intensity.
   * Stateless and swappable (e.g. future beat-sync allocator).
   */
  allocate(
    blocks: TimelineBlock[],
    options: {
      fps?: number;
      intensity?: AnimationIntensity;
      totalTargetSeconds?: number;
    } = {},
  ): TimelineBlock[] {
    const { fps = FPS, intensity = 'medium' } = options;
    const factor =
      typeof intensity === 'number'
        ? Math.max(0.5, Math.min(2, 1 / intensity))
        : (INTENSITY_FACTOR[intensity] ?? 1);

    const result: TimelineBlock[] = blocks.map((block) => {
      const wordCount = block.words.length || 1;
      let frames = Math.round(
        Math.min(
          MAX_FRAMES_PER_BLOCK,
          Math.max(MIN_FRAMES_PER_BLOCK, wordCount * BASE_FRAMES_PER_WORD * factor),
        ),
      );
      return {
        ...block,
        durationInFrames: frames,
      };
    });

    if (options.totalTargetSeconds != null && options.totalTargetSeconds > 0) {
      return this.scaleToTarget(result, options.totalTargetSeconds * fps);
    }
    return result;
  }

  private scaleToTarget(blocks: TimelineBlock[], targetFrames: number): TimelineBlock[] {
    const total = blocks.reduce((s, b) => s + b.durationInFrames, 0);
    if (total <= 0) return blocks;
    const scale = targetFrames / total;
    return blocks.map((b) => ({
      ...b,
      durationInFrames: Math.max(MIN_FRAMES_PER_BLOCK, Math.round(b.durationInFrames * scale)),
    }));
  }
}
