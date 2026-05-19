import { Injectable, Logger } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

@Injectable()
export class ElevenLabsTTSProvider implements ITextToSpeech {
  private readonly logger = new Logger(ElevenLabsTTSProvider.name);
  private readonly client: ElevenLabsClient | null = null;
  // Default Voice ID (Rachel) — used when voiceId is not a valid ElevenLabs ID
  private readonly defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

  // Internal voice label → ElevenLabs voice ID
  private readonly voiceMap: Record<string, string> = {
    amelia: 'Xb7hH8MSUJpSbSDYk0k2', // Alice - Clear, Engaging Educator
    rachel: '21m00Tcm4TlvDq8ikWAM',
    george: 'JBFqnCBsd6RMkjVDRZzb',
    charlie: 'IKne3meq5aSn9XLyUdCD',
    eric: 'cjVigY5qzO86Huf0OWal',
    brian: 'nPczCjzI2devNBz1zQrb',
    liam: 'TX3LPaxmHKxFdv7VOQHJ',
  };

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      this.logger.warn('ELEVENLABS_API_KEY not found');
    } else {
      this.client = new ElevenLabsClient({ apiKey });
    }
  }

  async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('ElevenLabs API Key is missing');
    }

    let text: string;
    let voiceId = this.defaultVoiceId;

    if (typeof optionsOrText === 'string') {
      text = optionsOrText;
    } else {
      text = optionsOrText.text;
      if (optionsOrText.voiceId) {
        const raw = optionsOrText.voiceId;
        voiceId = this.voiceMap[raw] ?? (this.isElevenLabsId(raw) ? raw : this.defaultVoiceId);
      }
    }

    this.logger.log(
      `Generating audio with ElevenLabs SDK... Text length: ${text.length}, Voice: ${voiceId}`,
    );

    let stability = 0.5;
    const similarityBoost = 0.8;
    const prompt = (typeof optionsOrText !== 'string' ? optionsOrText.prompt : '').toLowerCase();

    if (
      prompt.includes('excited') ||
      prompt.includes('energetic') ||
      prompt.includes('expressive')
    ) {
      stability = 0.35;
    } else if (
      prompt.includes('calm') ||
      prompt.includes('steady') ||
      prompt.includes('professional')
    ) {
      stability = 0.7;
    }

    try {
      const audioStream = await this.client!.textToSpeech.convert(voiceId, {
        text: text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        voiceSettings: {
          stability,
          similarityBoost,
        },
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      this.logger.log('ElevenLabs generation successful');
      return buffer;
    } catch (error) {
      this.logger.error('ElevenLabs TTS Failed', error);
      throw new Error(`ElevenLabs TTS Failed: ${error.message}`);
    }
  }

  private isElevenLabsId(id: string): boolean {
    return /^[A-Za-z0-9]{15,}$/.test(id);
  }
}
