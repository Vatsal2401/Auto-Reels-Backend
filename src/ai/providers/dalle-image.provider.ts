import { Injectable } from '@nestjs/common';
import { IImageGenerator } from '../interfaces/image-generator.interface';
import OpenAI from 'openai';

@Injectable()
export class DalleImageProvider implements IImageGenerator {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim()) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('Warning: OPENAI_API_KEY not set. Image generation will fail at runtime.');
    }
  }

  async generateImage(prompt: string): Promise<Buffer> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('Failed to generate image: No URL returned from DALL-E');
    }

    // Download the image from the URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
