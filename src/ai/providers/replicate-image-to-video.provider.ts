import { Injectable } from '@nestjs/common';
import { IImageToVideo } from '../interfaces/image-to-video.interface';
// Note: Install with: npm install replicate
// If not installed, this will use HuggingFace or Free provider instead
let Replicate: any;
try {
  Replicate = require('replicate').default || require('replicate');
} catch (e) {
  // Replicate package not installed - will use alternative provider
}

@Injectable()
export class ReplicateImageToVideoProvider implements IImageToVideo {
  private replicate: any = null; // Replicate instance (dynamically imported)
  private apiToken: string;

  constructor() {
    this.apiToken = process.env.REPLICATE_API_TOKEN || '';
    if (!Replicate) {
      console.warn('Warning: Replicate package not installed. Install with: npm install replicate');
      return;
    }
    if (this.apiToken && this.apiToken.trim()) {
      this.replicate = new Replicate({
        auth: this.apiToken,
      });
    } else {
      console.warn('Warning: REPLICATE_API_TOKEN not set. Image-to-video generation will fail at runtime.');
    }
  }

  async generateVideo(imageBuffer: Buffer, duration: number = 5): Promise<Buffer> {
    if (!Replicate) {
      throw new Error('Replicate package not installed. Install with: npm install replicate');
    }
    if (!this.replicate) {
      throw new Error('REPLICATE_API_TOKEN is not configured. Please set it in your .env file.');
    }

    // Convert buffer to data URL for Replicate
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    try {
      // Use Stable Video Diffusion (SVD)
      // Model: stability-ai/stable-video-diffusion:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b
      const output = await this.replicate.run(
        'stability-ai/stable-video-diffusion:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        {
          input: {
            input_image: dataUrl,
            video_length: "14 frames_with_svd_xt",
            sizing_strategy: "maintain_aspect_ratio",
            frames_per_second: 6,
            motion_bucket_id: 127,
            cond_aug: 0.02
          },
        },
      ) as any;

      console.log('Replicate Output:', JSON.stringify(output, null, 2));

      // Replicate returns either a string (video URL) or array of URLs
      let videoUrl: string;
      if (Array.isArray(output)) {
        videoUrl = output[0];
      } else if (typeof output === 'string') {
        videoUrl = output;
      } else {
        throw new Error('Failed to generate video: Invalid output format from Replicate');
      }

      if (!videoUrl || typeof videoUrl !== 'string') {
        throw new Error('Failed to generate video: No valid video URL returned from Replicate');
      }

      // Download the video from the URL
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(
        `Replicate image-to-video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
