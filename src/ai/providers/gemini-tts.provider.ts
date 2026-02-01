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
            this.logger.warn('GOOGLE_TTS_API_KEY or GEMINI_API_KEY not found. Gemini TTS fallback might fail if Application Default Credentials are not set.');
        }

        // Initialize the client
        // If GOOGLE_APPLICATION_CREDENTIALS is set automatically by the environment, no config is needed.
        // If using an API Key (less common for Node SDK but supported via fallback), we might need special handling.
        // However, the Node SDK primarily uses Service Account credentials.
        // We will attempt to use the API key if provided by creating a client that uses it, 
        // but typically the SDK prefers credentials.JSON content.
        // For this implementation, we'll instantiate with standard defaults which looking for env vars.

        // We will attempt to use the API key if provided by creating a client that uses it.
        // We strictly default to 'rest' fallback to ensure API Key compatibility (gRPC often requires full Credentials).
        if (this.apiKey) {
            this.client = new TextToSpeechClient({
                apiKey: this.apiKey,
                fallback: 'rest'
            });
        } else {
            // Fallback to ADC if no key provided
            this.client = new TextToSpeechClient();
        }
    }

    async textToSpeech(optionsOrText: AudioOptions | string): Promise<Buffer> {
        let text: string;
        let promptString = '';

        if (typeof optionsOrText === 'string') {
            text = optionsOrText;
        } else {
            text = optionsOrText.text;
            promptString = optionsOrText.prompt || '';
        }

        this.logger.log(`Generating audio with Gemini (Google TTS SDK)... Text length: ${text.length}`);

        // Determine voice based on prompt/text analysis
        // Journey voices: en-US-Journey-D (Male), en-US-Journey-F (Female)
        const isMale = promptString.toLowerCase().includes('male') || promptString.toLowerCase().includes('man');
        const voiceName = isMale ? 'en-US-Journey-D' : 'en-US-Journey-F';

        const request = {
            input: { text: text },
            voice: {
                languageCode: 'en-US',
                name: voiceName,
            },
            audioConfig: {
                audioEncoding: 'MP3' as const, // proper enum type
                speakingRate: 1.0,
                pitch: 0.0,
            },
        };

        try {
            const [response] = await this.client.synthesizeSpeech(request);

            if (response && response.audioContent) {
                this.logger.log(`Gemini TTS generation successful using voice: ${voiceName}`);

                // Ensure it's a Buffer
                if (response.audioContent instanceof Buffer) {
                    return response.audioContent;
                } else if (response.audioContent instanceof Uint8Array) {
                    return Buffer.from(response.audioContent);
                } else if (typeof response.audioContent === 'string') {
                    return Buffer.from(response.audioContent, 'base64');
                }

                throw new Error('Unknown audio content type received');
            } else {
                throw new Error('No audio content received from Google TTS SDK');
            }

        } catch (error: any) {
            if (error.code === 7 || error.message.includes('API has not been used')) {
                this.logger.error('Google Cloud TTS API is not enabled for this project.');
            }
            this.logger.error('Gemini TTS SDK Failed', error);
            throw new Error(`Gemini TTS SDK Failed: ${error.message}`);
        }
    }
}
