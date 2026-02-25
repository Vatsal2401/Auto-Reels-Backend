import { ICaptionStrategy } from './caption-strategy.interface';
import { ViralCaptionLine } from '../../services/viral-caption-optimizer.service';

export class ShortDurationStrategy implements ICaptionStrategy {
  // Constants for Reel-Native Snappiness
  private readonly MAX_CHARS_PER_BLOCK = 22;
  private readonly MAX_WORDS_PER_BLOCK = 3;
  private readonly MIN_BLOCK_DURATION = 1.0;
  private readonly MAX_BLOCK_DURATION = 1.5;

  generate(
    _audioBuffer: Buffer,
    script: string,
    speechSegments: { start: number; end: number }[],
    totalDuration: number,
    timingType: 'sentence' | 'word',
    preOptimizedLines?: ViralCaptionLine[],
  ): any[] {
    let blocks: string[][];

    if (preOptimizedLines && preOptimizedLines.length > 0) {
      // Pass 1 (AI-optimized): Use pre-split lines from Gemini
      blocks = preOptimizedLines.map((l) => l.line.trim().split(/\s+/));
    } else {
      // Pass 1 (heuristic): Break into "thought-like" blocks with punctuation awareness
      const tokens = script.replace(/\n+/g, ' ').trim().split(/\s+/);
      const heuristicBlocks: string[][] = [];
      let currentBlock: string[] = [];

      for (const token of tokens) {
        currentBlock.push(token);
        const isPunctuation = /[.?!,]$/.test(token);
        const line = currentBlock.join(' ');

        // Only split on punctuation if we have at least 2 words, to avoid tiny fragments
        if (
          (isPunctuation && currentBlock.length >= 2) ||
          line.length > this.MAX_CHARS_PER_BLOCK ||
          currentBlock.length >= this.MAX_WORDS_PER_BLOCK
        ) {
          heuristicBlocks.push(currentBlock);
          currentBlock = [];
        }
      }
      if (currentBlock.length > 0) heuristicBlocks.push(currentBlock);
      blocks = heuristicBlocks;
    }

    const speechTotal = speechSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    const effectiveTotal = speechTotal > 0.5 ? speechTotal : totalDuration;

    // Pass 2: Calculate rhythmic duration based on character weight
    const totalChars = blocks.reduce((sum, b) => sum + b.join(' ').length, 0);
    let lastEndTime = 0;
    const timings: any[] = [];
    let charCursor = 0;

    for (let i = 0; i < blocks.length; i++) {
      const blockChars = blocks[i].join(' ').length;
      const charRatio = blockChars / totalChars;
      const targetStart = (charCursor / totalChars) * effectiveTotal;
      charCursor += blockChars;

      // Map proportional time to real speech segments
      let rawStart = 0;
      let remaining = targetStart;
      if (speechSegments.length > 0) {
        for (const seg of speechSegments) {
          const len = seg.end - seg.start;
          if (remaining <= len) {
            rawStart = seg.start + remaining;
            break;
          }
          remaining -= len;
          rawStart = seg.end;
        }
      } else {
        rawStart = targetStart;
      }

      // --- LEAD-IN SYNC ---
      // Appearance bias: pull start back by 200ms to catch the eye before sound
      let realStart = Math.max(0, rawStart - 0.2);

      // Sequential lock: don't overlap previous
      if (realStart < lastEndTime) {
        realStart = lastEndTime;
      }

      // Character-weighted duration clamped to 1.0-1.5s
      const blockDuration = charRatio * effectiveTotal;
      let realEnd =
        realStart +
        Math.max(this.MIN_BLOCK_DURATION, Math.min(this.MAX_BLOCK_DURATION, blockDuration));

      if (realEnd > totalDuration) realEnd = totalDuration;
      if (realStart >= totalDuration) break;

      // Adaptive Casing: Single word punches are ALL CAPS, others are script-case
      const rawText = blocks[i].join(' ');
      const text = blocks[i].length === 1 ? rawText.toUpperCase() : rawText;

      // Generate Word-Level Timings for Karaoke
      const words = [];
      let wordCursor = realStart;
      const blockDurationReal = realEnd - realStart;
      const blockTotalChars = blocks[i].join('').length;

      for (const wordText of blocks[i]) {
        const wordChars = wordText.length;
        const wordRatio = blockTotalChars > 0 ? wordChars / blockTotalChars : 1 / blocks[i].length;
        const wordDur = wordRatio * blockDurationReal;

        const wStart = Number(wordCursor.toFixed(2));
        const wEnd = Number((wordCursor + wordDur).toFixed(2));

        words.push({
          text: wordText,
          start: wStart,
          end: wEnd,
        });

        wordCursor += wordDur;
      }

      timings.push({
        text,
        start: Number(realStart.toFixed(2)),
        end: Number(realEnd.toFixed(2)),
        ...(timingType === 'word' ? { words } : {}),
      });

      lastEndTime = realEnd;
    }

    // Pass 3: Seamless Tail-Out Extension (Breathing Space threshold: 1.5s)
    for (let i = 0; i < timings.length - 1; i++) {
      const current = timings[i];
      const next = timings[i + 1];
      const gap = next.start - current.end;
      // Bridge blinks and natural pauses up to 1.5s to keep text visible
      if (gap > 0 && gap < 1.5) {
        current.end = next.start;
      }
    }

    return timings;
  }
}
