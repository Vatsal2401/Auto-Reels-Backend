import { Readable } from 'stream';

export interface ComposeOptions {
  audioPath: string;
  captionPath: string;
  assetPaths: string[];
  duration?: number;
  rendering_hints?: any;
  captions?: {
    preset?: string;
    position?: string;
    timing?: string;
  };
  musicPath?: string;
  musicVolume?: number;
}

export interface IVideoRenderer {
  compose(options: ComposeOptions): Promise<Readable>;
}
