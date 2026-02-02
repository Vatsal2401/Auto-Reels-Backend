import { Injectable, Logger } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class LocalCaptionProvider implements ICaptionGenerator {
  private readonly logger = new Logger(LocalCaptionProvider.name);

  // --- CONFIGURATION CONSTANTS ---
  private readonly MIN_CAPTION_DURATION = 0.8; // Seconds
  private readonly MAX_CAPTION_DURATION = 2.5; // Seconds
  private readonly MAX_CHARS_PER_LINE = 28;
  private readonly MAX_WORDS_PER_CAPTION = 6;
  private readonly MIN_WORDS_PER_CAPTION = 2;
  private readonly MAX_TOTAL_CAPTIONS = 50; // Prevention of overflow for long scripts

  // Words to omit for punchy, editorial style
  private readonly FILLER_WORDS = new Set([
    'um',
    'uh',
    'er',
    'ah',
    'like',
    'you know',
    'basically',
    'actually',
    'literally',
    'so',
    'just',
    'well',
    'anyway',
    'anyhow',
  ]);

  async generateCaptions(
    audioBuffer: Buffer,
    script?: string,
    captionPrompt?: string,
  ): Promise<Buffer> {
    try {
      if (!script) return Buffer.from('', 'utf-8');

      this.logger.log('Generating Cinematic Local Captions...');

      // 1. Get exact audio duration using ffmpeg
      const duration = await this.getAudioDuration(audioBuffer);
      if (duration <= 0) {
        this.logger.warn('Could not determine audio duration, captions might be out of sync');
      }

      // 2. Generate Optimized SRT with word-weighted pacing
      const srt = this.generateSyncedSRT(script, duration);

      return Buffer.from(srt, 'utf-8');
    } catch (error) {
      this.logger.error('Cinematic caption generation failed:', error);
      return Buffer.from('', 'utf-8');
    }
  }

  private async getAudioDuration(buffer: Buffer): Promise<number> {
    const tempPath = join(tmpdir(), `temp-audio-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);
      return new Promise((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          try {
            unlinkSync(tempPath);
          } catch (e) {}
          if (err) resolve(0);
          else resolve(metadata.format.duration || 0);
        });
      });
    } catch (e) {
      this.logger.error('Failed to get audio duration', e);
      return 0;
    }
  }

  private generateSyncedSRT(script: string, totalDuration: number): string {
    // 1. Clean and filter script
    const words = script
      .replace(/\n/g, ' ')
      .replace(/[.,!?;:]/g, '') // Remove punctuation for timing calc
      .split(/\s+/)
      .filter((w) => w && !this.FILLER_WORDS.has(w.toLowerCase()));

    // 2. Group into Cinematic Blocks
    const blocks: string[] = [];
    let currentBlock: string[] = [];

    for (const word of words) {
      const potentialBlock = [...currentBlock, word].join(' ');

      if (
        currentBlock.length >= this.MAX_WORDS_PER_CAPTION ||
        potentialBlock.length > this.MAX_CHARS_PER_LINE
      ) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join(' '));
          currentBlock = [word];
        } else {
          // Single word is already too long (rare)
          blocks.push(word);
          currentBlock = [];
        }
      } else {
        currentBlock.push(word);
      }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock.join(' '));

    // Cap total captions to maintain performance and readability
    const limitedBlocks = blocks.slice(0, this.MAX_TOTAL_CAPTIONS);
    if (limitedBlocks.length === 0) return '';

    // 3. Word-Weighted Timing Calculation
    // Use character counts of words to weigh duration (longer words = more time)
    const blockWeights = limitedBlocks.map((block) => {
      // Base weight is character length + a small constant per word for overhead
      return block.length + block.split(' ').length * 2;
    });

    const totalWeight = blockWeights.reduce((a, b) => a + b, 0);
    const durations = blockWeights.map((w) => (w / totalWeight) * totalDuration);

    // 4. Enforce Duration Constraints and Pacing
    let srt = '';
    let currentTime = 0;

    limitedBlocks.forEach((text, index) => {
      let blockDuration = durations[index];

      // Apply Min/Max constraints
      blockDuration = Math.max(this.MIN_CAPTION_DURATION, blockDuration);
      blockDuration = Math.min(this.MAX_CAPTION_DURATION, blockDuration);

      // Optional: Slight emphasis for first and last caption (linger 10% longer)
      if (index === 0 || index === limitedBlocks.length - 1) {
        blockDuration *= 1.1;
      }

      const startTime = currentTime;
      const endTime = Math.min(startTime + blockDuration, totalDuration);

      // Break if we exceed total audio duration
      if (startTime >= totalDuration) return;

      // Header and Timing
      srt += `${index + 1}\n`;
      srt += `${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n`;

      // Editorial Formatting (Uppercase for punchiness)
      const punchyText = text.toUpperCase();

      // Smart Line Break (if still needed, though we split at 28 chars)
      srt += `${this.smartLineBreak(punchyText, 24)}\n\n`;

      currentTime = endTime;
    });

    return srt;
  }

  private smartLineBreak(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + word).length <= maxLen && !line2) {
        line1 += (line1 ? ' ' : '') + word;
      } else {
        line2 += (line2 ? ' ' : '') + word;
      }
    }
    return line2 ? `${line1}\n${line2}` : line1;
  }

  private formatTime(seconds: number): string {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
  }
}
