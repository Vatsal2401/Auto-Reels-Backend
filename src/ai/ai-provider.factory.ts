import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IScriptGenerator } from './interfaces/script-generator.interface';
import { ITextToSpeech } from './interfaces/text-to-speech.interface';
import { IImageGenerator } from './interfaces/image-generator.interface';
import { IImageToVideo } from './interfaces/image-to-video.interface';
import { ICaptionGenerator } from './interfaces/caption-generator.interface';
import { IIntentInterpreter } from './interfaces/intent-interpreter.interface';

// Import concrete providers to reference them by class/token
import { OpenAIScriptProvider } from './providers/openai-script.provider';
import { OpenAITTSProvider } from './providers/openai-tts.provider';
import { DalleImageProvider } from './providers/dalle-image.provider';
import { ReplicateImageToVideoProvider } from './providers/replicate-image-to-video.provider';
import { FreeImageToVideoProvider } from './providers/free-image-to-video.provider';
import { LocalCaptionProvider } from './providers/local-caption.provider';
import { MockScriptProvider } from './providers/mock-script.provider';
import { GeminiScriptProvider } from './providers/gemini-script.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import { GeminiVideoProvider } from './providers/gemini-video.provider';
import { ElevenLabsTTSProvider } from './providers/elevenlabs-tts.provider';
import { MockTTSProvider } from './providers/mock-tts.provider';
import { MockImageProvider } from './providers/mock-image.provider';
import { ReplicateImageProvider } from './providers/replicate-image.provider';
import { KaraokeCaptionProvider } from './providers/karaoke-caption.provider';
import { GeminiIntentProvider } from './providers/gemini-intent.provider';

@Injectable()
export class AiProviderFactory {
  constructor(private moduleRef: ModuleRef) {}

  getIntentInterpreter(providerName: string = 'gemini'): IIntentInterpreter {
    switch (providerName) {
      case 'gemini':
        return this.moduleRef.get(GeminiIntentProvider, { strict: false });
      default:
        throw new Error(`Intent Interpreter provider '${providerName}' not supported`);
    }
  }

  getScriptGenerator(providerName: string = 'openai'): IScriptGenerator {
    switch (providerName) {
      case 'openai':
        return this.moduleRef.get(OpenAIScriptProvider, { strict: false });
      case 'gemini':
        return this.moduleRef.get(GeminiScriptProvider, { strict: false });
      case 'mock':
        return this.moduleRef.get(MockScriptProvider, { strict: false });
      default:
        throw new Error(`Script provider '${providerName}' not supported`);
    }
  }

  getTextToSpeech(providerName: string = 'openai'): ITextToSpeech {
    switch (providerName) {
      case 'openai':
        return this.moduleRef.get(OpenAITTSProvider, { strict: false });
      case 'elevenlabs':
        return this.moduleRef.get(ElevenLabsTTSProvider, { strict: false });
      case 'mock':
        return this.moduleRef.get(MockTTSProvider, { strict: false });
      default:
        throw new Error(`TTS provider '${providerName}' not supported`);
    }
  }

  getImageGenerator(providerName: string = 'dalle'): IImageGenerator {
    switch (providerName) {
      case 'dalle':
        return this.moduleRef.get(DalleImageProvider, { strict: false });
      case 'gemini':
        return this.moduleRef.get(GeminiImageProvider, { strict: false });
      case 'replicate':
        return this.moduleRef.get(ReplicateImageProvider, { strict: false });
      case 'mock':
        return this.moduleRef.get(MockImageProvider, { strict: false });
      default:
        throw new Error(`Image provider '${providerName}' not supported`);
    }
  }

  getImageToVideo(providerName: string = 'replicate'): IImageToVideo {
    switch (providerName) {
      case 'replicate':
        return this.moduleRef.get(ReplicateImageToVideoProvider, { strict: false });
      case 'gemini':
        return this.moduleRef.get(GeminiVideoProvider, { strict: false });
      case 'free':
        return this.moduleRef.get(FreeImageToVideoProvider, { strict: false });
      default:
        // Fallback
        return this.moduleRef.get(FreeImageToVideoProvider, { strict: false });
    }
  }

  getCaptionGenerator(providerName: string = 'local'): ICaptionGenerator {
    switch (providerName) {
      case 'karaoke':
        return this.moduleRef.get(KaraokeCaptionProvider, { strict: false });
      case 'replicate':
      case 'local':
        return this.moduleRef.get(LocalCaptionProvider, { strict: false });
      default:
        throw new Error(`Caption provider '${providerName}' not supported`);
    }
  }
}
