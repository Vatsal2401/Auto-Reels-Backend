
import { Injectable, Logger } from '@nestjs/common';
import { IImageGenerator } from '../interfaces/image-generator.interface';

// Use require to bypass TS strict import checks for this CJS module in a Mixed environment
const Replicate = require('replicate');

@Injectable()
export class ReplicateImageProvider implements IImageGenerator {
    private readonly logger = new Logger(ReplicateImageProvider.name);
    private replicate: any; // Type as any or loosely typed to avoid "Namespace as type" error

    constructor() {
        const auth = process.env.REPLICATE_API_TOKEN;
        if (!auth) {
            this.logger.warn('REPLICATE_API_TOKEN not found');
        } else {
            this.replicate = new Replicate({ auth });
        }
    }

    async generateImage(prompt: string): Promise<Buffer> {
        if (!this.replicate) {
            throw new Error('Replicate client not initialized');
        }

        this.logger.log(`Generating image with Replicate (Flux Schnell)... Prompt: ${prompt.substring(0, 50)}...`);

        try {
            const output = await this.replicate.run(
                "black-forest-labs/flux-schnell",
                {
                    input: {
                        prompt: prompt,
                        go_fast: true,
                        megapixels: "1",
                        num_outputs: 1,
                        aspect_ratio: "16:9",
                        output_format: "png",
                        output_quality: 80
                    }
                }
            );

            let imageUrl: string;

            if (Array.isArray(output) && output.length > 0) {
                const item = output[0];
                if (typeof item === 'string') {
                    imageUrl = item;
                } else if (item instanceof ReadableStream || (item && typeof item.getReader === 'function')) {
                    const streamToBuffer = async (stream: any) => {
                        const chunks = [];
                        for await (const chunk of stream) {
                            chunks.push(Buffer.from(chunk));
                        }
                        return Buffer.concat(chunks);
                    };

                    return await streamToBuffer(item);
                } else {
                    // Handle case where stream iterable but not instance of ReadableStream class (Node vs Web)
                    if (item[Symbol.asyncIterator]) {
                        const chunks = [];
                        for await (const chunk of item) {
                            chunks.push(Buffer.from(chunk));
                        }
                        return Buffer.concat(chunks);
                    }
                }
            }

            if (imageUrl) {
                const response = await fetch(imageUrl);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }

            throw new Error(`Unexpected Replicate output format: ${JSON.stringify(output)}`);

        } catch (error) {
            this.logger.error('Replicate Image Generation Failed', error);
            throw error;
        }
    }
}
