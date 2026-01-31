import { Injectable, Logger } from '@nestjs/common';
import { IImageGenerator, ImageGenerationOptions } from '../interfaces/image-generator.interface';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiImageProvider implements IImageGenerator {
    private readonly logger = new Logger(GeminiImageProvider.name);
    private client: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found');
        } else {
            this.client = new GoogleGenAI({ apiKey });
        }
    }

    async generateImage(optionsOrPrompt: ImageGenerationOptions | string): Promise<Buffer> {
        const options = typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
        const results = await this.generateImages({ ...options, count: 1 });
        return results[0];
    }

    async generateImages(options: ImageGenerationOptions & { count: number }): Promise<Buffer[]> {
        if (!this.client) {
            throw new Error('Gemini client not initialized (missing key)');
        }

        let prompt = options.prompt;
        const aspectRatio = options.aspectRatio || "16:9";
        const style = options.style || "";

        if (style && style !== 'auto') {
            prompt = `${style} style. ${prompt}`;
        }

        this.logger.log(`Generating ${options.count} images with Gemini (Imagen 4)... Prompt: ${prompt.substring(0, 50)}... Ratio: ${aspectRatio}`);

        try {
            const modelId = 'imagen-4.0-generate-001';

            const response = await this.client.models.generateImages({
                model: modelId,
                prompt: prompt,
                config: {
                    numberOfImages: Math.min(options.count, 4), // Gemini limit is usually 4
                    aspectRatio: aspectRatio,
                    outputMimeType: "image/jpeg"
                }
            });

            if (!response || !response.generatedImages || response.generatedImages.length === 0) {
                throw new Error('No images returned from Gemini API');
            }

            return response.generatedImages.map((img: any) => {
                const imgObj = img.image as any;

                // Handle new SDK imageBytes format
                if (imgObj && imgObj.imageBytes) {
                    return Buffer.from(imgObj.imageBytes, 'base64');
                }

                // Keep existing fallbacks for compatibility
                if (imgObj && imgObj.base64) {
                    return Buffer.from(imgObj.base64, 'base64');
                } else if (imgObj instanceof Uint8Array) {
                    return Buffer.from(imgObj);
                } else if (typeof imgObj === 'string') {
                    return Buffer.from(imgObj, 'base64');
                }
                throw new Error('Unexpected image format in response');
            });

        } catch (error) {
            this.logger.error('Gemini Batch Image Generation Failed', error);
            throw error;
        }
    }
}
