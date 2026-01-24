export interface ComposeOptions {
  audio: Buffer;
  caption: Buffer;
  assets: Buffer[];
  duration?: number;
}

export interface IVideoRenderer {
  compose(options: ComposeOptions): Promise<Buffer>;
}
