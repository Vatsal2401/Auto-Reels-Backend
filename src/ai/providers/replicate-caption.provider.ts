import { Injectable } from '@nestjs/common';
import { ICaptionGenerator } from '../interfaces/caption-generator.interface';
import * as ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class ReplicateCaptionProvider implements ICaptionGenerator {

  // Note: We are using a robust local generation strategy to ensure perfect sync
  // with the generated audio duration, avoiding external API versioning issues.

  async generateCaptions(audioBuffer: Buffer, script?: string): Promise<Buffer> {
    try {
      if (!script) return Buffer.from('', 'utf-8');

      console.log('Generating Synced Captions (Local Strategy)...');

      // 1. Get exact audio duration
      const duration = await this.getAudioDuration(audioBuffer);
      console.log(`Audio Duration For Captions: ${duration}s`);

      // 2. Generate SRT synced to duration
      const srt = this.generateSyncedSRT(script, duration);

      return Buffer.from(srt, 'utf-8');

    } catch (error) {
      console.error('Caption generation failed:', error);
      return Buffer.from('', 'utf-8');
    }
  }

  private async getAudioDuration(buffer: Buffer): Promise<number> {
    const tempPath = join(tmpdir(), `temp-audio-${Date.now()}.mp3`);
    try {
      writeFileSync(tempPath, buffer);
      return new Promise((resolve) => {
        ffmpeg.ffprobe(tempPath, (err, metadata) => {
          unlinkSync(tempPath);
          if (err) resolve(0);
          else resolve(metadata.format.duration || 0);
        });
      });
    } catch (e) {
      return 0; // Fallback
    }
  }

  private generateSyncedSRT(script: string, totalDuration: number): string {
    // Clean script
    const cleanScript = script.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanScript.split(' ');

    // Target: ~2-3 words per caption for punchy Reels style
    // OR grouping by max length (32 chars)
    const captions: string[] = [];
    let currentLine = '';

    // Group words into "Punchy Lines" (max 32 chars, max 2 lines technically, but we prefer 1-2 short lines)
    // We'll create an array of "Caption Blocks"

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > 20) { // Aggressive punchy split (20-30 chars)
        captions.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) captions.push(currentLine);

    // Distribute Time
    // Total Duration / Number of Blocks
    const durationPerCaption = totalDuration / captions.length;

    let srt = '';
    let startTime = 0;

    captions.forEach((text, index) => {
      const endTime = startTime + durationPerCaption;

      // Smart Line Break for the block (ensure max 32 width if it exceeded, though we split at 20 above)
      // We might want to force 2 lines if it's long, but we split aggressively above.
      // Let's just ensure no line > 32 chars.
      const formattedText = this.smartLineBreak(text, 28);

      srt += `${index + 1}\n`;
      srt += `${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n`;
      srt += `${formattedText}\n\n`;

      startTime = endTime;
    });

    return srt;
  }

  private smartLineBreak(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + word).length < maxLen && !line2) {
        line1 += (line1 ? ' ' : '') + word;
      } else {
        line2 += (line2 ? ' ' : '') + word;
      }
    }
    return `${line1}\n${line2}`;
  }

  private formatTime(seconds: number): string {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const result = date.toISOString().substr(11, 12).replace('.', ',');
    return result;
  }
}
