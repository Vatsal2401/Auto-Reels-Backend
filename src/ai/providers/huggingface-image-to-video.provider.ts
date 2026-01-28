import { Injectable } from '@nestjs/common';
import { IImageToVideo } from '../interfaces/image-to-video.interface';

/**
 * Hugging Face Image-to-Video Provider (FREE)
 * 
 * Uses Hugging Face Inference API - FREE tier available
 * Model: stabilityai/stable-video-diffusion-img2vid
 * 
 * Get free API key: https://huggingface.co/settings/tokens
 * No credit card required for free tier
 */
@Injectable()
export class HuggingFaceImageToVideoProvider implements IImageToVideo {
  private apiToken: string;
  private baseUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid';

  constructor() {
    this.apiToken = process.env.HUGGINGFACE_API_KEY || '';
    if (!this.apiToken) {
      console.warn('Warning: HUGGINGFACE_API_KEY not set. Using free tier (may be slower).');
    }
  }

  async generateVideo(imageBuffer: Buffer, duration: number = 5): Promise<Buffer> {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');

    try {
      // Hugging Face Inference API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      // First, upload image and get task ID
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          inputs: {
            image: `data:image/png;base64,${base64Image}`,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
      }

      // Hugging Face may return video directly or a task URL
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('video')) {
        // Video returned directly
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else {
        // JSON response with video URL or base64
        const result = await response.json();
        
        if (result.video_url) {
          // Download from URL
          const videoResponse = await fetch(result.video_url);
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
          }
          const arrayBuffer = await videoResponse.arrayBuffer();
          return Buffer.from(arrayBuffer);
        } else if (result.video) {
          // Base64 encoded video
          return Buffer.from(result.video, 'base64');
        } else {
          throw new Error('Unexpected response format from Hugging Face API');
        }
      }
    } catch (error) {
      throw new Error(
        `Hugging Face image-to-video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
