export interface IImageToVideo {
  generateVideo(imageBuffer: Buffer, duration?: number): Promise<Buffer>;
}
