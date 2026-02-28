import { Injectable, Logger, Inject } from '@nestjs/common';
import { IStorageService } from '../storage/interfaces/storage.interface';
import { NormalizedVoice } from './elevenlabs.service';
import { IVoiceManagementService } from './interfaces/voice-management.interface';
import { isHindi, toSarvamLanguageCode, preprocessTextForSarvam } from './utils/language.util';

/** Voice type -> English and optional Hindi Sarvam speaker names. */
const VOICE_MAP: Record<string, { en: string; hi?: string }> = {
  'Viral Energetic': { en: 'kabir', hi: 'aayan' },
  'Story / Podcast': { en: 'rahul', hi: 'rohan' },
  'Soft / Aesthetic': { en: 'priya', hi: 'simran' },
  'Authority / Explainer': { en: 'aditya', hi: 'dev' },
  'Mad Scientist - Energetic': { en: 'varun' },
  'Creator Natural (Lofi)': { en: 'manan' },
  'Creator Natural (Creator)': { en: 'soham' },
  'Creator Natural (Explainer)': { en: 'advait' },
  Sad: { en: 'suhani' },
  'Soft Romantic': { en: 'kavya', hi: 'ishita' },
  'Grounded And Professional': { en: 'amelia' },
  'Old Rich': { en: 'ratan' },
};

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

@Injectable()
export class SarvamService implements IVoiceManagementService {
  private readonly logger = new Logger(SarvamService.name);

  constructor(@Inject('IStorageService') private readonly storageService: IStorageService) {}

  async getVoices(): Promise<NormalizedVoice[]> {
    const list: NormalizedVoice[] = [];
    for (const [type, ids] of Object.entries(VOICE_MAP)) {
      const enId = ids.en;
      const hiId = ids.hi ?? ids.en;
      list.push({ value: enId, label: type, meta: 'English' });
      list.push({ value: hiId, label: type, meta: 'Hindi' });
    }
    return list;
  }

  getVoiceId(voiceType: string, language: string): string {
    const entry = VOICE_MAP[voiceType];
    if (!entry) return VOICE_MAP['Grounded And Professional'].en;
    return isHindi(language) && entry.hi ? entry.hi : entry.en;
  }

  async generatePreview(voiceId: string, language: string): Promise<Buffer> {
    this.logger.log(`Generating Sarvam TTS preview: voiceId=${voiceId}, language=${language}`);

    const langCode = toSarvamLanguageCode(language);
    const cacheFileName = `sarvam-${voiceId}-${language}.mp3`;
    const cacheKey = `users/system/media/tts-previews/audio/${cacheFileName}`;

    try {
      const cachedBuffer = await this.storageService.download(cacheKey);
      this.logger.log(`Cache HIT for Sarvam voice ${voiceId} (key: ${cacheKey})`);
      return cachedBuffer;
    } catch (_e) {
      this.logger.log(`Cache MISS for Sarvam voice ${voiceId}. Calling API...`);
    }

    const previewText = isHindi(language)
      ? 'नमस्ते, यह मेरी आवाज़ का पूर्वावलोकन है।'
      : 'Hello, this is a preview of my voice.';

    const buffer = await this.callSarvamAPI(voiceId, previewText, langCode, 1.0);

    try {
      await this.storageService.upload({
        userId: 'system',
        mediaId: 'tts-previews',
        type: 'audio',
        buffer,
        fileName: cacheFileName,
      });
      this.logger.log(`Saved Sarvam preview to cache: ${cacheKey}`);
    } catch (cacheErr) {
      this.logger.warn('Failed to write Sarvam preview to cache', cacheErr);
    }

    return buffer;
  }

  async callSarvamAPI(
    voiceId: string,
    text: string,
    langCode: string,
    pace: number,
  ): Promise<Buffer> {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) throw new Error('SARVAM_API_KEY is not set');

    const processedText = preprocessTextForSarvam(text, langCode);

    // bulbul:v2 supports enable_preprocessing which normalizes English words/slang
    // inside Indic-script text so they are pronounced in Hindi accent, not English.
    // bulbul:v3 is higher-quality but does NOT support enable_preprocessing.
    const isHindiScript = langCode === 'hi-IN' || langCode === 'mr-IN';
    const model = isHindiScript ? 'bulbul:v2' : 'bulbul:v3';

    const requestBody: Record<string, any> = {
      text: processedText,
      target_language_code: langCode,
      speaker: voiceId,
      model,
      speech_sample_rate: 44100,
      pace,
    };

    if (isHindiScript) {
      requestBody.enable_preprocessing = true;
    }

    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sarvam API error ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    return Buffer.from(json.audios[0], 'base64');
  }
}
