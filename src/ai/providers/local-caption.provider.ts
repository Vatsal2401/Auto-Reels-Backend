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

  // --- CONFIGURATION CONSTANTS ---
  private readonly MIN_CAPTION_DURATION = 0.8; // Seconds
  private readonly MAX_CAPTION_DURATION = 2.5; // Seconds
  private readonly MAX_CHARS_PER_LINE = 28;
  private readonly MAX_WORDS_PER_CAPTION = 6;
  private readonly MIN_WORDS_PER_CAPTION = 2;
  private readonly MAX_TOTAL_CAPTIONS = 50;

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

      this.logger.log('Generating Advanced SubStation Alpha (ASS) Captions...');

      // 1. Get exact audio duration
      const duration = await this.getAudioDuration(audioBuffer);

      // 2. Generate Timing Data
      const assTimings = this.generateAssTimings(script, duration, timing);

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

  private async getAudioDuration(buffer: Buffer): Promise<number> {
    const tempPath = join(tmpdir(), `temp-audio-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);
      return new Promise((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          try {
            unlinkSync(tempPath);
          } catch {}
          if (err) resolve(0);
          else resolve(metadata.format.duration || 0);
        });
      });
    } catch (e) {
      this.logger.error('Failed to get audio duration', e);
      return 0;
    }
  }

  private generateAssTimings(
    script: string,
    totalDuration: number,
    timingMode: 'sentence' | 'word',
  ): AssTiming[] {
    const rawWords = script
      .replace(/\n/g, ' ')
      .replace(/[.,!?;:]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const blocks: string[][] = [];

    if (timingMode === 'word') {
      // Grouping for word mode to keep lines readable (1-3 words)
      for (let i = 0; i < rawWords.length; i++) {
        const current = rawWords[i];
        const next = rawWords[i + 1];
        if (next && current.length < 5 && current.length + next.length < 12) {
          blocks.push([current, next]);
          i++;
        } else {
          blocks.push([current]);
        }
      }
    } else {
      // Sentence grouping
      let currentBlock: string[] = [];
      for (const word of rawWords) {
        if (
          currentBlock.length >= this.MAX_WORDS_PER_CAPTION ||
          [...currentBlock, word].join(' ').length > this.MAX_CHARS_PER_LINE
        ) {
          blocks.push(currentBlock);
          currentBlock = [word];
        } else {
          currentBlock.push(word);
        }
      }
      if (currentBlock.length > 0) blocks.push(currentBlock);
    }

    const limitedBlocks = blocks.slice(0, this.MAX_TOTAL_CAPTIONS);

    // Weighting
    const blockWeights = limitedBlocks.map((b) => b.join(' ').length + b.length * 2);
    const totalWeight = blockWeights.reduce((a, b) => a + b, 0);
    const blockDurations = blockWeights.map((w) => (w / totalWeight) * totalDuration);

    let currentTime = 0;
    return limitedBlocks.map((words, index) => {
      const start = currentTime;
      const duration = Math.min(
        blockDurations[index],
        timingMode === 'word' ? 1.5 : this.MAX_CAPTION_DURATION,
      );
      const end = Math.min(start + duration, totalDuration);

      currentTime = end;

      const timing: AssTiming = {
        text: words.join(' ').toUpperCase(),
        start,
        end,
      };

      if (timingMode === 'word') {
        // Distribute block duration among words for karaoke tags
        const totalChars = words.join('').length;
        timing.words = words.map((w) => ({
          word: w.toUpperCase(),
          durationMs: Math.round((w.length / totalChars) * duration * 1000),
        }));
      }

      return timing;
    });
  }
}
