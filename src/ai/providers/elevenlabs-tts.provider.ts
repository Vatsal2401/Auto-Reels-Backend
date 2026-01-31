import { Injectable, Logger } from '@nestjs/common';
import { ITextToSpeech, AudioOptions } from '../interfaces/text-to-speech.interface';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

@Injectable()
export class ElevenLabsTTSProvider implements ITextToSpeech {
    private readonly logger = new Logger(ElevenLabsTTSProvider.name);
    private readonly client: ElevenLabsClient;
    // Default Voice ID (Rachel)
    private readonly defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

    constructor() {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            this.logger.warn('ELEVENLABS_API_KEY not found');
        }
        this.client = new ElevenLabsClient({ apiKey });
    }

    async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
        if (!process.env.ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API Key is missing');
        }

        let text: string;
        let voiceId = this.defaultVoiceId;

        if (typeof optionsOrText === 'string') {
            text = optionsOrText;
        } else {
            text = optionsOrText.text;
            if (optionsOrText.voiceId) {
                voiceId = optionsOrText.voiceId;
            }
        }

        this.logger.log(`Generating audio with ElevenLabs SDK... Text length: ${text.length}, Voice: ${voiceId}`);

        try {
            const audioStream = await this.client.textToSpeech.convert(
                voiceId,
                {
                    text: text,
                    modelId: "eleven_multilingual_v2",
                    outputFormat: "mp3_44100_128",
                    voiceSettings: {
                        stability: 0.5,
                        similarityBoost: 0.8
                    }
                }
            );

            // Convert ReadStream to Buffer
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
}
