import { Injectable, Logger } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class LocalCaptionProvider implements ICaptionGenerator {
  private readonly logger = new Logger(LocalCaptionProvider.name);

  // Constants for Reel-Native Snappiness
  private readonly MAX_CHARS_PER_BLOCK = 22;
  private readonly MAX_WORDS_PER_BLOCK = 3;
  private readonly MIN_BLOCK_DURATION = 1.0;
  private readonly MAX_BLOCK_DURATION = 1.5;

  constructor() {}

  async generateCaptions(
    audioBuffer: Buffer,
    script?: string,
    _prompt?: string,
    _timing: 'sentence' | 'word' = 'sentence',
    _config: any = {},
  ): Promise<Buffer> {
    try {
      if (!script) return Buffer.from('', 'utf-8');

      this.logger.log('Generating Reel-Native Captions (JSON)...');

      // 1. Get audio analysis (speech segments)
      const { speechSegments, totalDuration } = await this.getAudioAnalysis(audioBuffer);
      this.logger.log(
        `Audio analysis complete: ${totalDuration}s, ${speechSegments.length} segments`,
      );

      // 2. Generate Deterministic Timings
      const timings = this.generateDeterministicTimings(
        script,
        speechSegments,
        totalDuration,
        _timing,
      );
      this.logger.log(`Timing generation complete: ${timings.length} captions`);

      // 3. Return as JSON Buffer
      return Buffer.from(JSON.stringify(timings), 'utf-8');
    } catch (error) {
      this.logger.error('Caption generation failed:', error);
      return Buffer.from('[]', 'utf-8');
    }
  }

  private async getAudioAnalysis(
    buffer: Buffer,
  ): Promise<{ totalDuration: number; speechSegments: { start: number; end: number }[] }> {
    const tempPath = join(tmpdir(), `temp-audio-analysis-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);

      const totalDuration = await new Promise<number>((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          if (err) {
            this.logger.error(`ffprobe failed for ${tempPath}: ${err.message}`);
            resolve(0);
          } else {
            const dur =
              metadata.format.duration || (metadata.streams && metadata.streams[0]?.duration);
            this.logger.log(`ffprobe raw duration: ${dur} (format: ${metadata.format.duration})`);
            resolve(Number(dur) || 0);
          }
        });
      });

      const silences: { start: number; end: number }[] = [];
      await new Promise<void>((resolve) => {
        ffmpeg(tempPath)
          .audioFilters('silencedetect=noise=-30dB:d=0.1')
          .format('null')
          .on('stderr', (line) => {
            const startMatch = line.match(/silence_start: (\d+(\.\d+)?)/);
            const endMatch = line.match(/silence_end: (\d+(\.\d+)?)/);
            if (startMatch) silences.push({ start: parseFloat(startMatch[1]), end: totalDuration });
            if (endMatch && silences.length > 0)
              silences[silences.length - 1].end = parseFloat(endMatch[1]);
          })
          .on('end', () => resolve())
          .on('error', () => resolve())
          .output('/dev/null')
          .run();
      });

      try {
        unlinkSync(tempPath);
      } catch {}

      const speechSegments: { start: number; end: number }[] = [];
      let cursor = 0;
      for (const silence of silences) {
        if (silence.start > cursor + 0.05) {
          speechSegments.push({ start: cursor, end: silence.start });
        }
        cursor = silence.end;
      }
      if (cursor < totalDuration - 0.05) {
        speechSegments.push({ start: cursor, end: totalDuration });
      }

      return { totalDuration, speechSegments };
    } catch (e) {
      this.logger.error(`Audio analysis failed: ${e.message}`, e.stack);
      return { totalDuration: 0, speechSegments: [] };
    }
  }

  private generateDeterministicTimings(
    script: string,
    speechSegments: { start: number; end: number }[],
    totalFileDuration: number,
    _timing: 'sentence' | 'word' = 'sentence',
  ): any[] {
    const tokens = script.replace(/\n+/g, ' ').trim().split(/\s+/);
    const blocks: string[][] = [];
    let currentBlock: string[] = [];

    // Pass 1: Break into "thought-like" blocks with punctuation awareness
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
        blocks.push(currentBlock);
        currentBlock = [];
      }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);

    const speechTotal = speechSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    const effectiveTotal = speechTotal > 0.5 ? speechTotal : totalFileDuration;

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

      if (realEnd > totalFileDuration) realEnd = totalFileDuration;
      if (realStart >= totalFileDuration) break;

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
        // Only include words if explicitly requested (e.g. for Karaoke styling)
        // Otherwise, avoid overhead to keep standard captions static and snappy.
        ...(_timing === 'word' ? { words } : {}),
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
