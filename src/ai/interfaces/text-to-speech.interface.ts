export interface AudioOptions {
  text: string;
  voiceId?: string;
  language?: string;
}

export interface ITextToSpeech {
  textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer>;
}
