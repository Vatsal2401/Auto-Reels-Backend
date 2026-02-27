import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { ProjectsService } from '../projects/projects.service';
import { ProjectStatus } from '../projects/entities/project.entity';
import { getImageGenerationPrompt } from '../ai/prompts/image-prompts';

export interface GenerateImageDto {
  prompt: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  model: 'standard' | 'fast' | 'nano';
}

export interface GenerateImageResult {
  projectId: string;
  imageUrl: string;
  status: string;
}

@Injectable()
export class TextToImageService {
  private readonly logger = new Logger(TextToImageService.name);
  private client: GoogleGenAI | null = null;

  constructor(
    @Inject('IStorageService') private readonly storageService: IStorageService,
    private readonly projectsService: ProjectsService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found — text-to-image will not work');
    } else {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async generate(userId: string, dto: GenerateImageDto): Promise<GenerateImageResult> {
    if (!dto.prompt?.trim()) {
      throw new BadRequestException('Prompt is required');
    }
    if (!this.client) {
      throw new BadRequestException('Image generation is not configured (missing API key)');
    }

    const project = await this.projectsService.create(
      'text-to-image',
      { prompt: dto.prompt, aspectRatio: dto.aspectRatio, model: dto.model, credit_cost: 0 },
      userId,
    );

    await this.projectsService.updateStatus(project.id, ProjectStatus.PROCESSING);

    try {
      const enhancedPrompt = getImageGenerationPrompt(dto.prompt);
      let imageBuffer: Buffer;

      if (dto.model === 'nano') {
        // Gemini Flash image generation — uses generateContent with image modality
        const modelId = 'gemini-3.1-flash-image-preview';
        this.logger.log(`Generating image with model ${modelId} for project ${project.id}`);

        const response = await this.client.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          config: { responseModalities: ['image', 'text'] } as any,
        });

        const parts: any[] = response?.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imagePart?.inlineData?.data) {
          throw new Error('No image returned from Gemini Flash API');
        }
        imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      } else {
        // Imagen 4 — uses generateImages
        const modelId =
          dto.model === 'fast' ? 'imagen-4.0-fast-generate-001' : 'imagen-4.0-generate-001';

        this.logger.log(`Generating image with model ${modelId} for project ${project.id}`);

        const response = await this.client.models.generateImages({
          model: modelId,
          prompt: enhancedPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: dto.aspectRatio,
            outputMimeType: 'image/jpeg',
          },
        });

        if (!response?.generatedImages?.length) {
          throw new Error('No image returned from Gemini API');
        }

        const imgObj = response.generatedImages[0].image as any;

        if (imgObj?.imageBytes) {
          imageBuffer = Buffer.from(imgObj.imageBytes, 'base64');
        } else if (imgObj?.base64) {
          imageBuffer = Buffer.from(imgObj.base64, 'base64');
        } else if (imgObj instanceof Uint8Array) {
          imageBuffer = Buffer.from(imgObj);
        } else if (typeof imgObj === 'string') {
          imageBuffer = Buffer.from(imgObj, 'base64');
        } else {
          throw new Error('Unexpected image format in Gemini response');
        }
      }

      const objectKey = await this.storageService.upload({
        userId,
        mediaId: project.id,
        type: 'image',
        buffer: imageBuffer,
        fileName: 'output.jpg',
      });

      await this.projectsService.setOutput(project.id, objectKey);

      const imageUrl = await this.storageService.getSignedUrl(objectKey, 3600);

      this.logger.log(`Image generation complete for project ${project.id}`);

      return { projectId: project.id, imageUrl, status: 'completed' };
    } catch (error: any) {
      this.logger.error(`Image generation failed for project ${project.id}`, error);
      await this.projectsService.updateStatus(
        project.id,
        ProjectStatus.FAILED,
        null,
        error?.message ?? 'Unknown error',
      );
      throw error;
    }
  }
}
