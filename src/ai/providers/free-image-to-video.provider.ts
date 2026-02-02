import { Injectable } from '@nestjs/common';
import { IImageToVideo } from '../interfaces/image-to-video.interface';
import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Free Image-to-Video Provider (Local Processing)
 *
 * Uses FFmpeg to create a simple video from image
 * This is a basic implementation - creates a static video with the image
 * For testing purposes only - not production quality
 *
 * NO API KEY REQUIRED - 100% FREE
 */
@Injectable()
export class FreeImageToVideoProvider implements IImageToVideo {
  async generateVideo(imageBuffer: Buffer, prompt: string, duration: number = 5): Promise<Buffer> {
    const tempDir = tmpdir();
    const imagePath = join(tempDir, `image-${Date.now()}.png`);
    const outputPath = join(tempDir, `video-${Date.now()}.mp4`);

    try {
      // Write image to temp file
      writeFileSync(imagePath, imageBuffer);

      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(imagePath)
          .inputOptions(['-loop', '1', '-t', duration.toString()])
          .outputOptions([
            '-c:v libx264',
            '-preset ultrafast',
            '-pix_fmt yuv420p',
            '-vf scale=1024:1024',
            '-r 30',
          ])
          .output(outputPath)
          .on('end', () => {
            try {
              // Check if file exists before reading
              if (!existsSync(outputPath)) {
                throw new Error(`FFmpeg output file not created: ${outputPath}`);
              }
              const videoBuffer = readFileSync(outputPath);
              if (!videoBuffer || videoBuffer.length === 0) {
                throw new Error(`FFmpeg output file is empty: ${outputPath}`);
              }
              resolve(videoBuffer);
            } catch (error) {
              this.cleanup([imagePath, outputPath]);
              reject(error);
            } finally {
              this.cleanup([imagePath, outputPath]);
            }
          })
          .on('error', (error) => {
            this.cleanup([imagePath, outputPath]);
            reject(new Error(`FFmpeg error: ${error.message}`));
          })
          .run();
      });
    } catch (error) {
      this.cleanup([imagePath, outputPath]);
      throw new Error(
        `Free image-to-video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
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
