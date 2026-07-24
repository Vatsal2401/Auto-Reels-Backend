import { Injectable, Logger } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';
import { SarvamService } from '../sarvam.service';
import { toSarvamLanguageCode } from '../utils/language.util';

// Sarvam AI TTS provider — ભારતીય ભાષાઓ માટે text-to-speech
// Primary TTS provider: SARVAM_API_KEY હોય ત્યારે આ use થાય
@Injectable()
export class SarvamTTSProvider implements ITextToSpeech {
  private readonly logger = new Logger(SarvamTTSProvider.name);

  constructor(private readonly sarvamService: SarvamService) {}

  // script text ને audio buffer (mp3) માં convert કરે છે
  async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
    let text: string;
    let voiceId = 'aditya'; // default voice — bulbul:v3 model compatible
    let language = 'English (US)';
    let prompt = '';

    if (typeof optionsOrText === 'string') {
      // simple string pass થઈ હોય
      text = optionsOrText;
    } else {
      // full options object pass થઈ હોય
      text = optionsOrText.text;
      // voiceId valid Sarvam voice હોય તો override કરો (ElevenLabs ID reject)
      if (optionsOrText.voiceId && this.isSarvamVoiceId(optionsOrText.voiceId)) {
        voiceId = optionsOrText.voiceId;
      }
      if (optionsOrText.language) language = optionsOrText.language;
      if (optionsOrText.prompt) prompt = optionsOrText.prompt.toLowerCase();
    }

    // language code convert કરો (e.g. "English (US)" → "en-IN")
    const langCode = toSarvamLanguageCode(language);
    // audio mood ના based speaking speed decide કરો
    const pace = this.getPace(prompt);

    this.logger.log(
      `Generating audio with Sarvam: voice=${voiceId}, lang=${langCode}, pace=${pace}, textLen=${text.length}`,
    );

    // Sarvam API call કરીને audio buffer return કરો
    return this.sarvamService.callSarvamAPI(voiceId, text, langCode, pace);
  }

  // audio mood ના based speaking speed (pace) return કરે છે
  private getPace(prompt: string): number {
    if (/excited|energetic|viral/.test(prompt)) return 1.15; // fast
    if (/calm|soft|lofi|aesthetic/.test(prompt)) return 0.9; // slow
    if (/sad|romantic|emotional/.test(prompt)) return 0.85; // slowest
    if (/professional|authority|podcast/.test(prompt)) return 0.95;
    return 1.0; // default normal speed
  }

  // Sarvam voice IDs ફક્ત lowercase letters હોય (e.g. "aditya", "ritu")
  // ElevenLabs IDs long alphanumeric strings હોય — તે reject કરો
  private isSarvamVoiceId(id: string): boolean {
    return /^[a-z]+$/.test(id);
  }
}
