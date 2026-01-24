export interface ICaptionGenerator {
  generateCaptions(script: string): Promise<Buffer>;
}
