export interface IImageToVideo {
  generateVideo(imageBuffer: Buffer, prompt: string, duration?: number): Promise<Buffer>;
}
