import { ViralCaptionLine } from '../../services/viral-caption-optimizer.service';

export interface ICaptionStrategy {
  generate(
    audioBuffer: Buffer,
    script: string,
    speechSegments: { start: number; end: number }[],
    totalDuration: number,
    timingType: 'sentence' | 'word',
    preOptimizedLines?: ViralCaptionLine[],
  ): {
    start: number;
    end: number;
    text: string;
    highlight?: string | null;
    intensity?: number;
    words?: { text: string; start: number; end: number }[];
  }[];
}
