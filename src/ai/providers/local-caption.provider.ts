import { Injectable, Logger } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { AssSubtitleProvider, AssTiming } from './ass-subtitle.provider';

@Injectable()
export class LocalCaptionProvider implements ICaptionGenerator {
  private readonly logger = new Logger(LocalCaptionProvider.name);

  // --- CONFIGURATION CONSTANTS (Tweakable for UX) ---
  private readonly MAX_CHARS_PER_LINE = 28;
  private readonly MAX_WORDS_PER_CAPTION = 6;
  private readonly MAX_TOTAL_CAPTIONS = 300;

  // Perceptual Timing Offsets
  private readonly LEAD_IN_MS = 80; // Appear 80ms before speech
  private readonly TAIL_OUT_MS = 120; // Stay 120ms after speech ends

  private readonly MIN_CAPTION_DURATION = 0.6; // Min 600ms on screen
  private readonly MAX_CAPTION_DURATION = 3.2; // Max 3.2s per caption
  private readonly MIN_WORD_DURATION_MS = 100; // Min 100ms for highlights

  constructor(private readonly assProvider: AssSubtitleProvider) {}

  async generateCaptions(
    audioBuffer: Buffer,
    script?: string,
    _prompt?: string,
    timing: 'sentence' | 'word' = 'sentence',
    config: any = {},
  ): Promise<Buffer> {
    try {
      if (!script) return Buffer.from('', 'utf-8');

      this.logger.log('Generating Perceptual-Sync ASS Captions...');

      // 1. Get audio analysis (speech segments)
      const { speechSegments, totalDuration } = await this.getAudioAnalysis(audioBuffer, script);

      // 2. Generate Timing Data mapped to Speech Segments
      const assTimings = this.generateAssTimings(script, speechSegments, totalDuration, timing);

      // 3. Generate ASS Content
      const assConfig = {
        preset: config.preset || 'clean-minimal',
        position: config.position || 'bottom',
        timing: timing,
      };

      const assContent = this.assProvider.generateAssContent(assTimings, assConfig);

      return Buffer.from(assContent, 'utf-8');
    } catch (error) {
      this.logger.error('Caption generation failed:', error);
      return Buffer.from('', 'utf-8');
    }
  }

  private async getAudioAnalysis(
    buffer: Buffer,
    script: string,
  ): Promise<{ totalDuration: number; speechSegments: { start: number; end: number }[] }> {
    const tempPath = join(tmpdir(), `temp-audio-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);

      const totalDuration = await new Promise<number>((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          if (err) resolve(0);
          else resolve(metadata.format.duration || 0);
        });
      });

      // Pass 1: Fine-grained map (-30dB, 0.1s)
      const silences: { start: number; end: number; duration: number }[] = [];
      await new Promise<void>((resolve) => {
        let currentSilence: { start: number; end?: number } | null = null;
        ffmpeg(tempPath)
          .audioFilters('silencedetect=noise=-30dB:d=0.1')
          .format('null')
          .on('stderr', (line) => {
            const startMatch = line.match(/silence_start: (\d+(\.\d+)?)/);
            if (startMatch) {
              if (currentSilence)
                silences.push({
                  start: currentSilence.start,
                  end: parseFloat(startMatch[1]),
                  duration: parseFloat(startMatch[1]) - currentSilence.start,
                });
              currentSilence = { start: parseFloat(startMatch[1]) };
            }
            const endMatch = line.match(/silence_end: (\d+(\.\d+)?)/);
            if (endMatch && currentSilence) {
              currentSilence.end = parseFloat(endMatch[1]);
              silences.push({
                start: currentSilence.start,
                end: currentSilence.end,
                duration: currentSilence.end - currentSilence.start,
              });
              currentSilence = null;
            }
          })
          .on('end', () => {
            if (currentSilence)
              silences.push({
                start: currentSilence.start,
                end: totalDuration,
                duration: totalDuration - currentSilence.start,
              });
            resolve();
          })
          .on('error', () => resolve())
          .output('/dev/null')
          .run();
      });

      try {
        unlinkSync(tempPath);
      } catch {}

      const rawSegments: { start: number; end: number; len: number }[] = [];
      let cursor = 0;
      for (const silence of silences) {
        if (silence.start > cursor + 0.02) {
          rawSegments.push({ start: cursor, end: silence.start, len: silence.start - cursor });
        }
        cursor = silence.end;
      }
      if (cursor < totalDuration - 0.02) {
        rawSegments.push({ start: cursor, end: totalDuration, len: totalDuration - cursor });
      }

      // Boundary Clustering
      let lastSolidIdx = -1;
      for (let i = rawSegments.length - 1; i >= 0; i--) {
        if (rawSegments[i].len > 0.25) {
          lastSolidIdx = i;
          break;
        }
      }

      let effectiveEnd = totalDuration;
      if (lastSolidIdx !== -1) {
        let truncateIdx = lastSolidIdx;
        for (let i = lastSolidIdx + 1; i < rawSegments.length; i++) {
          const gap = rawSegments[i].start - rawSegments[i - 1].end;
          // If the gap is > 1.1s, we check if the rest is sparse noise
          if (gap > 1.1) {
            const remainingSpeech = rawSegments.slice(i).reduce((sum, s) => sum + s.len, 0);
            const remainingTime = totalDuration - rawSegments[i].start;
            // If remaining time is mostly noise (less than 15% speech density)
            if (remainingSpeech < 1.0 || remainingSpeech / remainingTime < 0.15) {
              break; // Stop here, everything after this gap is noise
            }
          }
          truncateIdx = i;
        }
        if (truncateIdx < rawSegments.length - 1) {
          effectiveEnd = rawSegments[truncateIdx].end;
          this.logger.log(`Truncating noisy tail at ${effectiveEnd.toFixed(2)}s`);
        }
      }

      const charCount = script.length;
      const minPace = 7.5;
      const maxAllowedDuration = charCount / minPace;
      if (effectiveEnd > maxAllowedDuration + 4) {
        const ceiling = Math.min(totalDuration, maxAllowedDuration + 5);
        if (effectiveEnd > ceiling) effectiveEnd = ceiling;
      }

      const speechSegments = rawSegments
        .map((seg) => ({
          start: Math.min(seg.start, effectiveEnd),
          end: Math.min(seg.end, effectiveEnd),
        }))
        .filter((seg) => seg.end - seg.start > 0.05);

      return { totalDuration, speechSegments };
    } catch (e) {
      this.logger.error('Failed to analyze audio', e);
      return { totalDuration: 0, speechSegments: [] };
    }
  }

  /**
   * Smarter Script Segmentation
   * Splits by punctuation and conjunctions to create natural phrases.
   */
  private segmentScript(script: string): string[][] {
    // 1. Clean script
    const cleanScript = script.replace(/\n+/g, ' ').trim();

    // 2. Tokenize by space BUT keep punctuation attached to words
    const tokens = cleanScript.split(/\s+/);

    const blocks: string[][] = [];
    let currentBlock: string[] = [];

    const punctuationRegex = /[.!?;,]/;
    const conjunctions = new Set([
      'and',
      'but',
      'or',
      'so',
      'yet',
      'for',
      'nor',
      'because',
      'although',
      'while',
    ]);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const hasPunctuation = punctuationRegex.test(token);
      const isConjunction = conjunctions.has(token.toLowerCase());

      const potentialLine = [...currentBlock, token].join(' ');

      // Decision Logic:
      // Break if:
      // - Max length exceeded
      // - Max words exceeded
      // - Token has strong punctuation (., !, ?) - UNLESS the block is very short
      // - Next word is a conjunction and we have enough words

      if (currentBlock.length > 0) {
        const tooLong = potentialLine.length > this.MAX_CHARS_PER_LINE;
        const tooManyWords = currentBlock.length >= this.MAX_WORDS_PER_CAPTION;
        const shouldBreakOnPunctuation = hasPunctuation && currentBlock.length >= 2;
        const shouldBreakBeforeConjunction = isConjunction && currentBlock.length >= 3;

        if (tooLong || tooManyWords || shouldBreakOnPunctuation || shouldBreakBeforeConjunction) {
          blocks.push(currentBlock);
          currentBlock = [token];
          continue;
        }
      }

      currentBlock.push(token);
    }

    if (currentBlock.length > 0) blocks.push(currentBlock);
    return blocks;
  }

  private generateAssTimings(
    script: string,
    speechSegments: { start: number; end: number }[],
    totalFileDuration: number,
    timingMode: 'sentence' | 'word',
  ): AssTiming[] {
    // 1. Better Segmentation
    const blocks = this.segmentScript(script);
    const limitedBlocks = blocks.slice(0, this.MAX_TOTAL_CAPTIONS);

    // 2. Weighting & Allocation
    const speechTotal = speechSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    const effectiveTotal = speechTotal > 0.5 ? speechTotal : totalFileDuration;
    const useSegments = speechTotal > 0.5;

    // We weight blocks based on character length + a small constant per word
    const blockWeights = limitedBlocks.map((b) => b.join(' ').length + b.length * 2);
    const totalWeight = blockWeights.reduce((a, b) => a + b, 0);
    const blockSpeechDurations = blockWeights.map((w) => (w / totalWeight) * effectiveTotal);

    let currentSpeechTime = 0;

    const toRealTime = (speechT: number): number => {
      if (!useSegments) return speechT;
      let remaining = speechT;
      for (const seg of speechSegments) {
        const segLen = seg.end - seg.start;
        if (remaining <= segLen + 0.005) return seg.start + Math.max(0, remaining);
        remaining -= segLen;
      }
      return speechSegments[speechSegments.length - 1]?.end || totalFileDuration;
    };

    const leadIn = this.LEAD_IN_MS / 1000;
    const tailOut = this.TAIL_OUT_MS / 1000;

    return limitedBlocks.map((words, index) => {
      const startSpeech = currentSpeechTime;
      const durationSpeech = blockSpeechDurations[index];
      const endSpeech = startSpeech + durationSpeech;
      currentSpeechTime = endSpeech;

      // Map to real timeline
      let start = toRealTime(startSpeech) - leadIn;
      let end = toRealTime(endSpeech) + tailOut;

      // Clamping and Safety
      start = Math.max(0, start);

      // Ensure minimum and maximum durations per caption
      const duration = end - start;
      if (duration < this.MIN_CAPTION_DURATION) {
        end = start + this.MIN_CAPTION_DURATION;
      } else if (duration > this.MAX_CAPTION_DURATION) {
        end = start + this.MAX_CAPTION_DURATION;
      }

      // Don't extend past file end
      end = Math.min(end, totalFileDuration);

      const timing: AssTiming = {
        text: words
          .join(' ')
          .replace(/[.,!?;:]/g, '')
          .toUpperCase(),
        start,
        end,
      };

      if (timingMode === 'word') {
        const cleanWords = words.map((w) => w.replace(/[.,!?;:]/g, ''));
        const totalChars = cleanWords.join('').length;
        const realDurationMs = (end - start) * 1000;

        // Distribute duration based on word length
        let currentTotalMs = 0;
        timing.words = cleanWords.map((w, i) => {
          let wordDurationMs = (w.length / totalChars) * realDurationMs;

          // Clamp word highlight to be at least MIN_WORD_DURATION_MS
          wordDurationMs = Math.max(this.MIN_WORD_DURATION_MS, wordDurationMs);

          const roundedMs = Math.round(wordDurationMs);
          currentTotalMs += roundedMs;

          return {
            word: w.toUpperCase(),
            durationMs: roundedMs,
          };
        });

        // Correct for rounding and clamping drift in the last word
        const drift = Math.round(realDurationMs) - currentTotalMs;
        if (timing.words.length > 0) {
          // Apply drift to the last word, but don't let it go below min
          timing.words[timing.words.length - 1].durationMs = Math.max(
            this.MIN_WORD_DURATION_MS,
            timing.words[timing.words.length - 1].durationMs + drift,
          );
        }
      }

      return timing;
    });
  }
}
