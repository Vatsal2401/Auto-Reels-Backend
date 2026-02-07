export interface ICaptionStrategy {
  generate(
    audioBuffer: Buffer,
    script: string,
    speechSegments: { start: number; end: number }[],
    totalDuration: number,
    timingType: 'sentence' | 'word',
  ): {
    start: number;
    end: number;
    text: string;
    words?: { text: string; start: number; end: number }[];
  }[];
}
