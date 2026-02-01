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

        this.logger.log(`Generating ${options.count} images with Gemini (Imagen 4)...`);
        this.logger.debug(`FULL PROMPT: ${prompt}`);

        try {
            const modelId = 'imagen-4.0-generate-001';
            let response = await this.client.models.generateImages({
                model: modelId,
                prompt: prompt,
                config: {
                    numberOfImages: Math.min(options.count, 4),
                    aspectRatio: aspectRatio,
                    outputMimeType: "image/jpeg"
                }
            });

            this.logger.debug(`Gemini Imagen 4 Response: ${JSON.stringify(response, null, 2)}`);

            // FALLBACK to Imagen 3 if Imagen 4 returns no images
            if (!response || !response.generatedImages || response.generatedImages.length === 0) {
                this.logger.warn(`Imagen 4.0 returned no images. Falling back to Imagen 4.0 FAST... Prompt: ${prompt.substring(0, 50)}`);

                const fallbackModelId = 'imagen-4.0-fast-generate-001';
                response = await this.client.models.generateImages({
                    model: fallbackModelId,
                    prompt: prompt,
                    config: {
                        numberOfImages: Math.min(options.count, 4),
                        aspectRatio: aspectRatio,
                        outputMimeType: "image/jpeg"
                    }
                });

                this.logger.debug(`Gemini Imagen 4 Fast Response: ${JSON.stringify(response, null, 2)}`);
            }

            if (!response || !response.generatedImages || response.generatedImages.length === 0) {
                this.logger.error('Both Imagen 4 models returned no images.', { response });
                throw new Error('No images returned from Gemini API (both models failed)');
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
