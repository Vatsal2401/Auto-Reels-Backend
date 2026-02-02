import { Injectable, Logger, Inject } from '@nestjs/common';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { IStorageService } from '../storage/interfaces/storage.interface';

export interface NormalizedVoice {
  value: string;
  label: string;
  meta: string;
  description?: string;
}

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly client: ElevenLabsClient;

  constructor(@Inject('IStorageService') private readonly storageService: IStorageService) {
    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  async getVoices(): Promise<NormalizedVoice[]> {
    try {
      const { voices } = await this.client.voices.getAll();

      return voices.map((v) => ({
        value: v.voiceId,
        label: v.name || 'Unnamed Voice',
        meta: `${v.labels?.accent || 'Global'} ${v.labels?.gender || 'Neural'}`,
        description: v.labels?.description || '',
      }));
    } catch (error) {
      this.logger.error('Failed to fetch voices from ElevenLabs SDK', error);
      throw error;
    }
  }

  async generatePreview(voiceId: string, language: string): Promise<Buffer> {
    this.logger.log(`Generating TTS preview via SDK: voiceId=${voiceId}, language=${language}`);

    const modelId = this.getModelForLanguage(language);
    const text = language.toLowerCase().includes('spanish')
      ? 'Hola, esta es una vista previa de mi voz.'
      : 'Hello, this is a preview of my voice.';

    // Construct Cache Key (VoiceID + Language)
    // Cache path: users/system/media/tts-previews/audio/voiceId-lang-model.mp3
    const cacheFileName = `${voiceId}-${language}-${modelId}.mp3`;
    const cacheKey = `users/system/media/tts-previews/audio/${cacheFileName}`;

    // 1. Check Cache (Object Storage)
    try {
      const cachedBuffer = await this.storageService.download(cacheKey);
      this.logger.log(`Cache HIT for voice ${voiceId} (key: ${cacheKey})`);
      return cachedBuffer;
    } catch (e) {
      this.logger.log(`Cache MISS for voice ${voiceId}. Calling API...`);
    }

    try {
      // Use stream method but convert to buffer for preview
      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text,
        modelId: modelId,
        outputFormat: 'mp3_44100_128',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.8,
        },
      });

      // Read the stream into a buffer
      const chunks: any[] = [];
      for await (const chunk of audioStream as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 2. Save to Cache (Object Storage)
      try {
        await this.storageService.upload({
          userId: 'system',
          mediaId: 'tts-previews',
          type: 'audio',
          buffer: buffer,
          fileName: cacheFileName,
        });
        this.logger.log(`Saved preview to cache: ${cacheKey}`);
      } catch (cacheErr) {
        this.logger.warn('Failed to write to cache', cacheErr);
      }

      return buffer;
    } catch (error: any) {
      // Fallback for model if 400 occurred
      if (error.statusCode === 400 || error.message?.includes('model')) {
        this.logger.warn(`Primary model ${modelId} failed. Attempting fallback...`);
        try {
          const fallbackStream = await this.client.textToSpeech.convert(voiceId, {
            text,
            modelId: 'eleven_monolingual_v1',
            outputFormat: 'mp3_44100_128',
          });
          const chunks: any[] = [];
          for await (const chunk of fallbackStream as any) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          return buffer;
        } catch (fallbackError) {
          this.logger.error('Fallback generation also failed', fallbackError);
        }
      }

      this.logger.error(`Failed to generate TTS preview for voice ${voiceId}`, error);
      throw error;
    }
  }

  private getModelForLanguage(language: string): string {
    const mapping: Record<string, string> = {
      'English (US)': 'eleven_multilingual_v2',
      Spanish: 'eleven_multilingual_v2',
      French: 'eleven_multilingual_v2',
      German: 'eleven_multilingual_v2',
      Japanese: 'eleven_multilingual_v2',
    };

    return mapping[language] || 'eleven_multilingual_v2';
  }
}
