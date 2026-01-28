export interface ComposeOptions {
  audio: Buffer;
  caption: Buffer;
  assets?: Buffer[]; // Legacy: for backward compatibility
  video?: Buffer; // New: video from Replicate image-to-video
  duration?: number;
}

export interface IVideoRenderer {
  compose(options: ComposeOptions): Promise<Buffer>;
}
