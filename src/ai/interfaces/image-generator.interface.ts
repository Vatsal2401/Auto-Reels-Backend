export interface ImageGenerationOptions {
  prompt: string;
  style?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  provider?: 'replicate' | 'openai' | 'gemini';
}

export interface IImageGenerator {
  generateImage(optionsOrPrompt: ImageGenerationOptions | string): Promise<Buffer>;
  generateImages(options: ImageGenerationOptions & { count: number }): Promise<Buffer[]>;
}
