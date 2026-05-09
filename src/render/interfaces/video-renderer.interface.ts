import { Readable } from 'stream';

export interface SceneData {
  audio_text: string;
  duration: number;
}

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
  scenes?: SceneData[];
  hyperframesTemplate?: 'cinematic' | 'bold' | 'minimal' | 'neon';
}

export interface IVideoRenderer {
  compose(options: ComposeOptions): Promise<Readable>;
}
