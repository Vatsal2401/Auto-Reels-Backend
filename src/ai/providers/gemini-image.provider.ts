import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Modality } from '@google/genai';
import { IImageGenerator, ImageGenerationOptions } from '../interfaces/image-generator.interface';
import { getImageGenerationPrompt } from '../prompts/image-prompts';

// Model constants — change here to update everywhere
const IMAGEN_4_ULTRA = 'imagen-4.0-ultra-generate-001';
const IMAGEN_4 = 'imagen-4.0-generate-001';
const IMAGEN_4_FAST = 'imagen-4.0-fast-generate-001';
const GEMINI_FLASH_IMAGE = 'gemini-2.5-flash-image'; // generateContent + responseModalities: ['IMAGE']

@Injectable()
export class GeminiImageProvider implements IImageGenerator {
  private readonly logger = new Logger(GeminiImageProvider.name);
  private readonly client: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set — image generation will fail');
    }
    this.client = new GoogleGenAI({ apiKey: apiKey ?? '' });
  }

  async generateImage(optionsOrPrompt: ImageGenerationOptions | string): Promise<Buffer> {
    const options =
      typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
    const results = await this.generateImages({ ...options, count: 1 });
    return results[0];
  }

  async generateImages(options: ImageGenerationOptions & { count: number }): Promise<Buffer[]> {
    const aspectRatio = options.aspectRatio || '9:16';
    const prompt = getImageGenerationPrompt(options.prompt, options.style || '');
    const count = Math.min(options.count, 4);

    this.logger.log(`Generating ${count} image(s) — prompt: "${prompt.substring(0, 60)}..."`);

    // Primary: Imagen 4 Ultra (highest quality)
    try {
      return await this.generateWithImagen(prompt, count, aspectRatio, IMAGEN_4_ULTRA);
    } catch (err) {
      this.logger.warn(`Imagen 4 Ultra failed: ${(err as Error).message}. Trying Imagen 4...`);
    }

    // Secondary: Imagen 4 Standard
    try {
      return await this.generateWithImagen(prompt, count, aspectRatio, IMAGEN_4);
    } catch (err) {
      this.logger.warn(`Imagen 4 failed: ${(err as Error).message}. Trying Gemini Flash Image...`);
    }

    // Tertiary: Gemini Flash image generation (generateContent + responseModalities: ['IMAGE'])
    try {
      return await this.generateWithGeminiFlash(prompt, count);
    } catch (err) {
      this.logger.warn(
        `Gemini Flash image gen failed: ${(err as Error).message}. Trying Imagen 4 Fast...`,
      );
    }

    // Final fallback: Imagen 4 Fast
    return this.generateWithImagen(prompt, count, aspectRatio, IMAGEN_4_FAST);
  }

  // --- Imagen 4 path (dedicated image model via @google/genai) ---
  private async generateWithImagen(
    prompt: string,
    count: number,
    aspectRatio: string,
    model: string,
  ): Promise<Buffer[]> {
    const response = await this.client.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: count,
        aspectRatio,
        outputMimeType: 'image/jpeg',
      },
    });

    if (!response?.generatedImages?.length) {
      throw new Error(`${model} returned no images`);
    }

    this.logger.log(`${model}: generated ${response.generatedImages.length} image(s)`);
    return response.generatedImages.map((img) => this.extractImageBuffer(img.image));
  }

  // --- Gemini Flash image generation path (same model family as LangChain text models) ---
  // Uses generateContent() with responseModalities: ['IMAGE'] — the LangChain-equivalent pattern
  // for Gemini's native multimodal output capability
  private async generateWithGeminiFlash(prompt: string, count: number): Promise<Buffer[]> {
    const results: Buffer[] = [];

    // Gemini Flash generates one image per call; loop for count > 1
    for (let i = 0; i < count; i++) {
      const response = await this.client.models.generateContent({
        model: GEMINI_FLASH_IMAGE,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.IMAGE],
          temperature: 0.9,
        },
      });

      const parts = response?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

      if (!imagePart?.inlineData?.data) {
        throw new Error(`Gemini Flash returned no image data (call ${i + 1}/${count})`);
      }

      results.push(Buffer.from(imagePart.inlineData.data, 'base64'));
    }

    this.logger.log(`Gemini Flash: generated ${results.length} image(s)`);
    return results;
  }

  // --- Buffer extraction for Imagen response formats ---
  private extractImageBuffer(imgObj: any): Buffer {
    if (imgObj?.imageBytes) return Buffer.from(imgObj.imageBytes, 'base64');
    if (imgObj?.base64) return Buffer.from(imgObj.base64, 'base64');
    if (imgObj instanceof Uint8Array) return Buffer.from(imgObj);
    if (typeof imgObj === 'string') return Buffer.from(imgObj, 'base64');
    throw new Error('Unexpected image format in Imagen response');
  }
}
