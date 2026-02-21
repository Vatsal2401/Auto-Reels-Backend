import { Injectable, Logger } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';
import { SarvamService } from '../sarvam.service';
import { toSarvamLanguageCode } from '../utils/language.util';

@Injectable()
export class SarvamTTSProvider implements ITextToSpeech {
  private readonly logger = new Logger(SarvamTTSProvider.name);

  constructor(private readonly sarvamService: SarvamService) {}

  async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
    let text: string;
    let voiceId = 'amelia';
    let language = 'English (US)';
    let prompt = '';

    if (typeof optionsOrText === 'string') {
      text = optionsOrText;
    } else {
      text = optionsOrText.text;
      if (optionsOrText.voiceId && this.isSarvamVoiceId(optionsOrText.voiceId)) {
        voiceId = optionsOrText.voiceId;
      }
      if (optionsOrText.language) language = optionsOrText.language;
      if (optionsOrText.prompt) prompt = optionsOrText.prompt.toLowerCase();
    }

    const langCode = toSarvamLanguageCode(language);
    const pace = this.getPace(prompt);

    this.logger.log(
      `Generating audio with Sarvam: voice=${voiceId}, lang=${langCode}, pace=${pace}, textLen=${text.length}`,
    );

    return this.sarvamService.callSarvamAPI(voiceId, text, langCode, pace);
  }

  private getPace(prompt: string): number {
    if (/excited|energetic|viral/.test(prompt)) return 1.15;
    if (/calm|soft|lofi|aesthetic/.test(prompt)) return 0.9;
    if (/sad|romantic|emotional/.test(prompt)) return 0.85;
    if (/professional|authority|podcast/.test(prompt)) return 0.95;
    return 1.0;
  }

  /** Sarvam voices are simple lowercase alphabetic names (e.g. "kabir", "amelia").
   *  ElevenLabs IDs are long alphanumeric strings — reject those silently. */
  private isSarvamVoiceId(id: string): boolean {
    return /^[a-z]+$/.test(id);
  }
}
