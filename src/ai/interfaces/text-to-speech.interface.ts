export interface ITextToSpeech {
  textToSpeech(text: string): Promise<Buffer>;
}
