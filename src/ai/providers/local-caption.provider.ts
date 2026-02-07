import { Injectable, Logger } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import { ShortDurationStrategy } from './caption-strategies/short-duration.strategy';
import { LongDurationStrategy } from './caption-strategies/long-duration.strategy';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class LocalCaptionProvider implements ICaptionGenerator {
  private readonly logger = new Logger(LocalCaptionProvider.name);

  // Constants for Reel-Native Snappiness
  private readonly shortStrategy = new ShortDurationStrategy();
  private readonly longStrategy = new LongDurationStrategy();

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

      // 2. Select Strategy based on Duration
      // Cutoff: 60 seconds. Short = Snappy (Reels), Long = Narrative (Stories)
      const strategy = totalDuration > 60 ? this.longStrategy : this.shortStrategy;

      this.logger.log(
        `Selected Caption Strategy: ${totalDuration > 60 ? 'LongDuration' : 'ShortDuration'}`,
      );

      const timings = strategy.generate(
        audioBuffer,
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
}
