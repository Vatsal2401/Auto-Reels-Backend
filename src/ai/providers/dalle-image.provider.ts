import { Injectable } from '@nestjs/common';
import { IImageGenerator, ImageGenerationOptions } from '../interfaces/image-generator.interface';
import OpenAI from 'openai';
import { getImageGenerationPrompt } from '../prompts/image-prompts';

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

  async generateImage(optionsOrPrompt: ImageGenerationOptions | string): Promise<Buffer> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env file.');
    }

    let prompt: string;
    let size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024';
    let style = '';

    if (typeof optionsOrPrompt === 'string') {
      prompt = optionsOrPrompt;
    } else {
      prompt = optionsOrPrompt.prompt;
      if (optionsOrPrompt.aspectRatio === '16:9') {
        size = '1792x1024';
      } else if (optionsOrPrompt.aspectRatio === '9:16') {
        size = '1024x1792';
      } else {
        size = '1024x1024';
      }
      style = optionsOrPrompt.style || '';
    }

    prompt = getImageGenerationPrompt(prompt, style);

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      quality: 'standard',
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('Failed to generate image: No URL returned from DALL-E');
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generateImages(options: ImageGenerationOptions & { count: number }): Promise<Buffer[]> {
    const promises = Array(options.count)
      .fill(null)
      .map(() => this.generateImage(options));
    return Promise.all(promises);
  }
}
