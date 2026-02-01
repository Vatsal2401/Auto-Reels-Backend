import { Readable } from 'stream';

export interface ComposeOptions {
  audioPath: string;
  captionPath: string;
  assetPaths: string[];
  duration?: number;
  rendering_hints?: any;
}

export interface IVideoRenderer {
  compose(options: ComposeOptions): Promise<Readable>;
}
