import { Injectable } from '@nestjs/common';
import { IVideoRenderer, ComposeOptions } from '../interfaces/video-renderer.interface';
import * as ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

@Injectable()
export class FFmpegRendererProvider implements IVideoRenderer {
  async compose(options: ComposeOptions): Promise<Buffer> {
    const tempDir = tmpdir();
    const audioPath = join(tempDir, `audio-${Date.now()}.mp3`);
    const captionPath = join(tempDir, `caption-${Date.now()}.srt`);
    const outputPath = join(tempDir, `output-${Date.now()}.mp4`);

    try {
      // Write buffers to temp files
      writeFileSync(audioPath, options.audio);
      writeFileSync(captionPath, options.caption);

      // Create video from assets (for now, use first asset as video)
      // In production, you'd composite multiple assets
      const videoPath = options.assets.length > 0 
        ? await this.prepareVideoAsset(options.assets[0], tempDir)
        : null;

      return new Promise((resolve, reject) => {
        let command = ffmpeg();

        if (videoPath) {
          command = command.input(videoPath);
        } else {
          // Create a blank video if no assets
          command = command
            .input('color=c=black:s=1920x1080:d=' + (options.duration || 30))
            .inputFormat('lavfi');
        }

        command
          .input(audioPath)
          .inputOptions(['-stream_loop', '-1'])
          .complexFilter([
            // Add caption overlay
            {
              filter: 'subtitles',
              options: {
                filename: captionPath,
                force_style: 'FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000',
              },
            },
          ])
          .outputOptions([
            '-c:v libx264',
            '-preset medium',
            '-crf 23',
            '-c:a aac',
            '-b:a 192k',
            '-shortest',
          ])
          .output(outputPath)
          .on('end', () => {
            try {
              const videoBuffer = readFileSync(outputPath);
              resolve(videoBuffer);
            } catch (error) {
              reject(error);
            } finally {
              // Cleanup
              this.cleanup([audioPath, captionPath, outputPath, videoPath].filter(Boolean));
            }
          })
          .on('error', (error) => {
            this.cleanup([audioPath, captionPath, outputPath, videoPath].filter(Boolean));
            reject(error);
          })
          .run();
      });
    } catch (error) {
      this.cleanup([audioPath, captionPath, outputPath].filter(Boolean));
      throw error;
    }
  }

  private async prepareVideoAsset(assetBuffer: Buffer, tempDir: string): Promise<string> {
    const assetPath = join(tempDir, `asset-${Date.now()}.mp4`);
    writeFileSync(assetPath, assetBuffer);
    return assetPath;
  }

  private cleanup(paths: string[]): void {
    paths.forEach((path) => {
      try {
        if (path) unlinkSync(path);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }
}
