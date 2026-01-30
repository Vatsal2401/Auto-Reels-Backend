export interface ICaptionGenerator {
  generateCaptions(audioBuffer: Buffer, script?: string): Promise<Buffer>;
}
