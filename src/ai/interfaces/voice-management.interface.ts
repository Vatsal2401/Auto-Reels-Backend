import { NormalizedVoice } from '../elevenlabs.service';

export interface IVoiceManagementService {
  getVoices(): Promise<NormalizedVoice[]>;
  getVoiceId(voiceType: string, language: string): string;
  generatePreview(voiceId: string, language: string): Promise<Buffer>;
}
