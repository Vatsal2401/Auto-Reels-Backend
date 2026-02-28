import { Injectable, Logger } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import { ViralCaptionLine } from '../services/viral-caption-optimizer.service';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class KaraokeCaptionProvider implements ICaptionGenerator {
  private readonly logger = new Logger(KaraokeCaptionProvider.name);

  // Constants for Karaoke
  private readonly LEAD_IN_SECONDS = 0.2; // 200ms visual lead
  private readonly CHARS_PER_SECOND_AVG = 15; // Calibration for word duration

  constructor() {}

  async generateCaptions(
    audioBuffer: Buffer,
    script?: string,
    _prompt?: string,
    _timing: 'sentence' | 'word' = 'word', // Karaoke implies word-level focus
    _config: any = {},
  ): Promise<Buffer> {
    try {
      if (!script) return Buffer.from('', 'utf-8');

      this.logger.log('🎤 Generating Karaoke Timings (High-Precision)...');

      // 1. Audio Analysis
      const { speechSegments, totalDuration } = await this.getAudioAnalysis(audioBuffer);

      // 2. Generate Karaoke Hierarchy
      const preOptimizedLines = _config.preOptimizedLines as ViralCaptionLine[] | undefined;
      const timings = this.generateKaraokeTimings(
        script,
        speechSegments,
        totalDuration,
        preOptimizedLines,
      );

      // Merge highlight + intensity metadata from AI optimizer (by index)
      if (preOptimizedLines && preOptimizedLines.length > 0) {
        timings.forEach((t, i) => {
          t.highlight = preOptimizedLines[i]?.highlight ?? null;
          t.intensity = preOptimizedLines[i]?.intensity;
        });
      }

      return Buffer.from(JSON.stringify(timings), 'utf-8');
    } catch (error) {
      this.logger.error('Karaoke generation failed:', error);
      return Buffer.from('[]', 'utf-8');
    }
  }

  private async getAudioAnalysis(
    buffer: Buffer,
  ): Promise<{ totalDuration: number; speechSegments: { start: number; end: number }[] }> {
    // Reuse the robust analysis from LocalCaptionProvider
    // In a real refactor, this should be a SharedAudioService
    const tempPath = join(tmpdir(), `karaoke-audio-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);

      const totalDuration = await new Promise<number>((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          if (err) resolve(0);
          else {
            const dur =
              metadata.format.duration || (metadata.streams && metadata.streams[0]?.duration);
            resolve(Number(dur) || 0);
          }
        });
      });

      const silences: { start: number; end: number }[] = [];
      await new Promise<void>((resolve) => {
        ffmpeg(tempPath)
          .audioFilters('silencedetect=noise=-40dB:d=0.3') // Less aggressive pruning
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
      this.logger.error(`Audio analysis failed: ${e.message}`);
      return { totalDuration: 0, speechSegments: [] };
    }
  }

  private generateKaraokeTimings(
    script: string,
    speechSegments: { start: number; end: number }[],
    totalDuration: number,
    preOptimizedLines?: ViralCaptionLine[],
  ): any[] {
    // 1. CHUNKING: Use AI-optimized lines when available, otherwise strict heuristic split
    const karaokeLines =
      preOptimizedLines && preOptimizedLines.length > 0
        ? preOptimizedLines.map((l) => l.line.trim())
        : this.splitScriptStrictly(script);
    const totalChars = script.replace(/\s/g, '').length;

    // 2. AUDIO MAPPING: Distribute lines to speech islands
    const timings: any[] = [];

    // Calculate "Global Char Density" to map lines to islands
    // This estimates "where in the audio" a line roughly belongs
    let charCursor = 0;

    // Filter out tiny noise segments (< 0.2s)
    const validSegments = speechSegments.filter((s) => s.end - s.start > 0.2);
    const effectiveTotalDuration =
      validSegments.reduce((sum, s) => sum + (s.end - s.start), 0) || totalDuration;

    let lastIslandEnd = 0;

    for (let i = 0; i < karaokeLines.length; i++) {
      const line = karaokeLines[i];
      const lineChars = line.replace(/\s/g, '').length;

      // Percentage of total content this line represents
      const progressStart = charCursor / totalChars;
      const progressEnd = (charCursor + lineChars) / totalChars;

      // Map percentage to "Speech Time"
      const speechTimeStart = progressStart * effectiveTotalDuration;
      const speechTimeEnd = progressEnd * effectiveTotalDuration;

      // Find which island(s) cover this speech-time range
      // This is "Time Projection" onto the valid speech segments
      let accumulatedSpeech = 0;
      let startIslandIdx = -1;
      let startTimeInIsland = 0;

      // Find Start Time
      for (let s = 0; s < validSegments.length; s++) {
        const segLen = validSegments[s].end - validSegments[s].start;
        if (accumulatedSpeech + segLen >= speechTimeStart) {
          startIslandIdx = s;
          startTimeInIsland = validSegments[s].start + (speechTimeStart - accumulatedSpeech);
          break;
        }
        accumulatedSpeech += segLen;
      }

      // Find End Time (similar logic)
      accumulatedSpeech = 0;
      let endIslandIdx = -1;
      let endTimeInIsland = 0;
      for (let s = 0; s < validSegments.length; s++) {
        const segLen = validSegments[s].end - validSegments[s].start;
        if (accumulatedSpeech + segLen >= speechTimeEnd) {
          endIslandIdx = s;
          endTimeInIsland = validSegments[s].start + (speechTimeEnd - accumulatedSpeech);
          break;
        }
        accumulatedSpeech += segLen;
      }

      // Default fallbacks if math fails (e.g. slight overflow)
      if (startIslandIdx === -1) {
        // Determine sensible default
        startTimeInIsland = lastIslandEnd > 0 ? lastIslandEnd : 0;
        startIslandIdx = 0;
      }
      if (endIslandIdx === -1 || endTimeInIsland < startTimeInIsland) {
        endTimeInIsland = totalDuration;
      }

      let finalStart = startTimeInIsland;
      let finalEnd = endTimeInIsland;

      // Clamp: Don't start before previous ended
      if (finalStart < lastIslandEnd) finalStart = lastIslandEnd;

      // Force Minimum Duration (Readability) -> 0.3s per word approx?
      if (finalEnd - finalStart < 0.5) finalEnd = finalStart + 0.5;

      // Final phrase extension lock
      if (i === karaokeLines.length - 1) {
        finalEnd = totalDuration;
      }

      // --- WORD TIMING ---
      const words = line.split(/\s+/);
      const wordTimings: any[] = [];
      const duration = finalEnd - finalStart;
      let currentWordStart = finalStart;

      // Word Distribution: Proportional within the LINE's slot

      words.forEach((w) => {
        const wLen = w.length;
        const wRatio = wLen / lineChars;
        // Prevent divide by zero if line is all whitespace
        const wDur = lineChars > 0 ? wRatio * duration : duration / words.length;

        wordTimings.push({
          text: w,
          // Global Audio Start
          start: currentWordStart,
          // Global Audio End (Exact)
          end: Math.max(0, currentWordStart + wDur),
        });

        currentWordStart += wDur;
      });

      // Ensure we have timings
      if (wordTimings.length > 0) {
        let visualStart = Math.max(0, wordTimings[0].start - this.LEAD_IN_SECONDS);

        // Anti-Overlap Clamp:
        // Ensure we don't start before the previous line ended.
        if (timings.length > 0) {
          const prevEnd = timings[timings.length - 1].end;
          if (visualStart < prevEnd) {
            visualStart = prevEnd;
          }
        }

        timings.push({
          text: line,
          start: visualStart,
          // Visual End: Last Word Audio End.
          end: wordTimings[wordTimings.length - 1].end,
          words: wordTimings,
        });
      }

      lastIslandEnd = finalEnd;
      charCursor += lineChars;
    }

    return timings;
  }

  private splitScriptStrictly(script: string): string[] {
    // Strict limits: 40 chars OR 7 words max
    const MAX_CHARS = 40;
    const MAX_WORDS = 7;

    // Improve splitting: respect sentences but break long ones
    const rawPhrases = script.match(/[^.?!]+[.?!]+|[^.?!]+$/g) || [script];
    const lines: string[] = [];

    for (const phrase of rawPhrases) {
      const rawWords = phrase.trim().split(/\s+/);
      if (rawWords.length === 0 || (rawWords.length === 1 && !rawWords[0])) continue;

      let currentChunk: string[] = [];
      let currentLen = 0;

      for (const word of rawWords) {
        const wLen = word.length;
        // Check limits
        if (
          currentChunk.length > 0 &&
          (currentLen + wLen + 1 > MAX_CHARS || currentChunk.length >= MAX_WORDS)
        ) {
          lines.push(currentChunk.join(' '));
          currentChunk = [];
          currentLen = 0;
        }
        currentChunk.push(word);
        currentLen += wLen + (currentLen > 0 ? 1 : 0);
      }
      if (currentChunk.length > 0) lines.push(currentChunk.join(' '));
    }

    return lines;
  }
}
