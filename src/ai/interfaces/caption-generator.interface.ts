export interface ICaptionGenerator {
  generateCaptions(audioBuffer: Buffer, script?: string, captionPrompt?: string): Promise<Buffer>;
}
