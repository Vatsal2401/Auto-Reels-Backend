import { Injectable, Logger } from '@nestjs/common';
import { IImageToVideo } from '../interfaces/image-to-video.interface';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeminiVideoProvider implements IImageToVideo {
  private readonly logger = new Logger(GeminiVideoProvider.name);
  private client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found');
    } else {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async generateVideo(imageBuffer: Buffer, prompt: string, duration: number = 5): Promise<Buffer> {
    if (!this.client) {
      throw new Error('Gemini client not initialized (missing key)');
    }

    this.logger.log('Generating video with Gemini (Veo 3.1)...');

    try {
      const modelId = 'veo-3.1-generate-preview';

      // Construct Payload
      const request: any = {
        model: modelId,
        prompt: prompt || 'Cinematic, high quality, photorealistic video, 4k, fluid motion',
      };

      // If image is provided, add it to payload
      if (imageBuffer && imageBuffer.length > 0) {
        const imageBase64 = imageBuffer.toString('base64');
        request.video = {
          inlineData: {
            data: imageBase64,
            mimeType: 'image/png',
          },
        };
      }

      let operation = await this.client.models.generateVideos(request);

      this.logger.log(`Operation started. ID: ${operation.name}`);

      // Poll for completion
      while (!operation.done) {
        this.logger.debug('Waiting for video generation to complete (5s polling)...');
        await new Promise((resolve) => setTimeout(resolve, 5000));

        operation = await this.client.operations.getVideosOperation({
          operation: operation,
        });
      }

      this.logger.log('Generation Complete!');

      if (
        operation.response &&
        operation.response.generatedVideos &&
        operation.response.generatedVideos.length > 0
      ) {
        const videoResult = operation.response.generatedVideos[0].video;

        // Download the video to a temporary path
        const tmpPath = path.join('/tmp', `gemini_video_${Date.now()}.mp4`);
        this.logger.debug(`Downloading generated video to ${tmpPath}...`);

        await this.client.files.download({
          file: videoResult,
          downloadPath: tmpPath,
        });

        // Read buffer from file
        const buffer = fs.readFileSync(tmpPath);

        // Cleanup
        fs.unlinkSync(tmpPath);

        return buffer;
      }

      throw new Error('No video found in response');
    } catch (error) {
      this.logger.error('Gemini Video Generation Failed', error);
      throw error;
    }
  }
}
