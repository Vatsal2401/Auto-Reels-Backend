import { Injectable } from '@nestjs/common';
import { TimelineBlock, SplitMode } from './interfaces/timeline.interface';

@Injectable()
export class ScriptProcessorService {
  /**
   * Splits script into blocks (sentence or line based), tokenizes into words.
   * Does NOT set durationInFrames — use DurationAllocatorService after this.
   */
  process(
    script: string,
    options: {
      splitMode?: SplitMode;
      defaultPreset?: string;
    } = {},
  ): TimelineBlock[] {
    const { splitMode = 'sentence', defaultPreset = 'word-reveal' } = options;
    const trimmed = script.trim();
    if (!trimmed) return [];

    const segments =
      splitMode === 'line' ? this.splitByLines(trimmed) : this.splitBySentences(trimmed);

    return segments.map((text) => ({
      text: text.trim(),
      words: this.tokenizeWords(text.trim()),
      durationInFrames: 0, // filled by duration allocator
      animationPreset: defaultPreset,
    }));
  }

  private splitByLines(script: string): string[] {
    return script.split(/\n+/).filter((s) => s.trim().length > 0);
  }

  private splitBySentences(script: string): string[] {
    // Split on sentence-ending punctuation followed by space or end
    const segments = script.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    if (segments.length > 0) return segments;
    // Fallback: single block
    return [script];
  }

  private tokenizeWords(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
  }
}
