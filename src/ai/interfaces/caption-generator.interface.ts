export interface ICaptionGenerator {
  generateCaptions(
    audioBuffer: Buffer,
    script?: string,
    captionPrompt?: string,
    timing?: 'sentence' | 'word',
    config?: any,
  ): Promise<Buffer>;
}
