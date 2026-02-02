import { Injectable, Logger } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';
// Google Cloud Text-to-Speech Client Library
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

@Injectable()
export class GeminiTTSProvider implements ITextToSpeech {
  private readonly logger = new Logger(GeminiTTSProvider.name);
  private client: TextToSpeechClient;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;

    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_TTS_API_KEY or GEMINI_API_KEY not found. Gemini TTS fallback might fail if Application Default Credentials are not set.',
      );
    }

    if (this.apiKey) {
      this.client = new TextToSpeechClient({
        apiKey: this.apiKey,
        fallback: 'rest',
      });
    } else {
      this.client = new TextToSpeechClient();
    }
  }

  async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
    let text: string;
    let promptString = '';

    if (typeof optionsOrText === 'string') {
      text = optionsOrText.trim();
    } else {
      text = (optionsOrText.text || '').trim();
      promptString = optionsOrText.prompt || '';
    }

    if (!text) {
      this.logger.error('Received empty or whitespace-only text for TTS generation.');
      throw new Error('TTS Failed: Input text is empty. Please check your script content.');
    }

    this.logger.log(
      `Generating audio with Gemini TTS... Text Snippet: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (Length: ${text.length})`,
    );

    // Determine voice based on prompt/text analysis
    const isMale =
      promptString.toLowerCase().includes('male') || promptString.toLowerCase().includes('man');
    const primaryVoice = isMale ? 'en-US-Journey-D' : 'en-US-Journey-F';
    const fallbackVoice = isMale ? 'en-US-Wavenet-D' : 'en-US-Wavenet-F';

    try {
      return await this.synthesizeWithRetry(text, primaryVoice, fallbackVoice);
    } catch (error: any) {
      if (error.code === 7 || error.message.includes('API has not been used')) {
        this.logger.error('Google Cloud TTS API is not enabled for this project.');
      }
      this.logger.error('Gemini TTS SDK Failed', error);
      throw new Error(`Gemini TTS SDK Failed: ${error.message}`);
    }
  }

  private async synthesizeWithRetry(
    text: string,
    voiceName: string,
    fallbackVoice: string,
  ): Promise<Buffer> {
    const request = {
      input: { text: text },
      voice: { languageCode: 'en-US', name: voiceName },
      audioConfig: { audioEncoding: 'MP3' as const, speakingRate: 1.0, pitch: 0.0 },
    };

    try {
      const [response] = await this.client.synthesizeSpeech(request);
      return this.processResponse(response, voiceName);
    } catch (error: any) {
      // Journey voices are strict about "non-speakable" characters.
      // If it fails with a 400/INVALID_ARGUMENT, we try a more permissive Wavenet voice.
      if (
        error.message.includes('INVALID_ARGUMENT') ||
        error.code === 3 ||
        error.message.includes('empty input')
      ) {
        this.logger.warn(
          `Primary voice ${voiceName} failed. Falling back to permissive voice ${fallbackVoice}. Error: ${error.message}`,
        );
        const fallbackRequest = { ...request, voice: { ...request.voice, name: fallbackVoice } };
        const [response] = await this.client.synthesizeSpeech(fallbackRequest);
        return this.processResponse(response, fallbackVoice);
      }
      throw error;
    }
  }

  private processResponse(response: any, voiceName: string): Buffer {
    if (response && response.audioContent) {
      this.logger.log(`Gemini TTS success using voice: ${voiceName}`);
      if (response.audioContent instanceof Buffer) return response.audioContent;
      if (response.audioContent instanceof Uint8Array) return Buffer.from(response.audioContent);
      if (typeof response.audioContent === 'string')
        return Buffer.from(response.audioContent, 'base64');
      throw new Error('Unknown audio content type received');
    }
    throw new Error(`No audio content received using voice: ${voiceName}`);
  }
}
