import { Injectable, Logger } from '@nestjs/common';
import { IImageGenerator, ImageGenerationOptions } from '../interfaces/image-generator.interface';

import Replicate from 'replicate';

@Injectable()
export class ReplicateImageProvider implements IImageGenerator {
  private readonly logger = new Logger(ReplicateImageProvider.name);
  private replicate: any;

  constructor() {
    const auth = process.env.REPLICATE_API_TOKEN;
    if (!auth) {
      this.logger.warn('REPLICATE_API_TOKEN not found');
    } else {
      this.replicate = new Replicate({ auth });
    }
  }

  async generateImage(optionsOrPrompt: ImageGenerationOptions | string): Promise<Buffer> {
    const options =
      typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
    const results = await this.generateImages({ ...options, count: 1 });
    return results[0];
  }

  async generateImages(options: ImageGenerationOptions & { count: number }): Promise<Buffer[]> {
    if (!this.replicate) {
      throw new Error('Replicate client not initialized');
    }

    let prompt = options.prompt;
    const aspectRatio = options.aspectRatio || '16:9';
    const style = options.style || '';

    if (style && style !== 'auto') {
      prompt = `${style} style. ${prompt}`;
    }

    const numOutputs = Math.min(options.count, 4);
    this.logger.log(`Generating ${numOutputs} images with Replicate (Flux Schnell)...`);

    try {
      const output = await this.replicate.run('black-forest-labs/flux-schnell', {
        input: {
          prompt: prompt,
          go_fast: true,
          num_outputs: numOutputs,
          aspect_ratio: aspectRatio,
          output_format: 'png',
          output_quality: 80,
        },
      });

      const buffers: Buffer[] = [];
      const results = Array.isArray(output) ? output : [output];

      for (const item of results) {
        if (typeof item === 'string') {
          const response = await fetch(item);
          buffers.push(Buffer.from(await response.arrayBuffer()));
        } else if (item && item[Symbol.asyncIterator]) {
          const chunks = [];
          for await (const chunk of item) {
            chunks.push(Buffer.from(chunk));
          }
          buffers.push(Buffer.concat(chunks));
        }
      }

      return buffers;
    } catch (error) {
      this.logger.error('Replicate Batch Image Generation Failed', error);
      throw error;
    }
  }
}
