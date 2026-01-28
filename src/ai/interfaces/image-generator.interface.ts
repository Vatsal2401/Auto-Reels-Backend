export interface IImageGenerator {
  generateImage(prompt: string): Promise<Buffer>;
}
