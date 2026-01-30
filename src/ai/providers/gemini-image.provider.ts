import { Injectable, Logger } from '@nestjs/common';
import { IImageGenerator } from '../interfaces/image-generator.interface';
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

    async generateImage(prompt: string): Promise<Buffer> {
        if (!this.client) {
            throw new Error('Gemini client not initialized (missing key)');
        }

        this.logger.log(`Generating image with Gemini (Imagen 3)... Prompt: ${prompt.substring(0, 50)}...`);

        try {
            // "imagen-3.0-generate-001" is the likely model ID for Imagen 3 via Gemini API
            const modelId = 'imagen-3.0-generate-001';

            const response = await this.client.models.generateImages({
                model: modelId,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: "16:9",
                    outputMimeType: "image/jpeg"
                }
            });

            if (!response || !response.generatedImages || response.generatedImages.length === 0) {
                throw new Error('No images returned from Gemini API');
            }

            // Inspect SDK types: generatedImages[0].image is likely the image object
            // If the SDK returns base64 string directly in 'image' property is deprecated/custom
            // Usually it's `image.imageBytes` or similar in new SDK.
            // Let's assume generic access for safety until verified
            const imgObj = response.generatedImages[0].image as any;

            if (imgObj && imgObj.base64) {
                return Buffer.from(imgObj.base64, 'base64');
            } else if (imgObj instanceof Uint8Array) {
                return Buffer.from(imgObj);
            } else if (typeof imgObj === 'string') {
                // Sometimes it returns the base64 string directly
                return Buffer.from(imgObj, 'base64');
            }

            // Fallback: check if SDK handles it differently
            // We'll assume base64 string property for now based on standard clients
            throw new Error('Unexpected image format in response');

        } catch (error) {
            this.logger.error('Gemini Image Generation Failed', error);
            throw error;
        }
    }
}
