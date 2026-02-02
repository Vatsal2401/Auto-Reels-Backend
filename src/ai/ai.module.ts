import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { IScriptGenerator } from './interfaces/script-generator.interface';
import { ITextToSpeech } from './interfaces/text-to-speech.interface';
import { ICaptionGenerator } from './interfaces/caption-generator.interface';
import { IImageGenerator } from './interfaces/image-generator.interface';
import { IImageToVideo } from './interfaces/image-to-video.interface';
import { OpenAIScriptProvider } from './providers/openai-script.provider';
import { OpenAITTSProvider } from './providers/openai-tts.provider';
import { MockScriptProvider } from './providers/mock-script.provider';
import { MockTTSProvider } from './providers/mock-tts.provider';
import { MockImageProvider } from './providers/mock-image.provider';
import { DalleImageProvider } from './providers/dalle-image.provider';
import { ReplicateImageToVideoProvider } from './providers/replicate-image-to-video.provider';
import { HuggingFaceImageToVideoProvider } from './providers/huggingface-image-to-video.provider';
import { FreeImageToVideoProvider } from './providers/free-image-to-video.provider';
import { GeminiScriptProvider } from './providers/gemini-script.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import { GeminiVideoProvider } from './providers/gemini-video.provider';
import { ElevenLabsTTSProvider } from './providers/elevenlabs-tts.provider';
import { GeminiIntentProvider } from './providers/gemini-intent.provider';
import { GeminiTTSProvider } from './providers/gemini-tts.provider';
import { LocalCaptionProvider } from './providers/local-caption.provider';
import { ElevenLabsService } from './elevenlabs.service';
import { VoicesController } from './controllers/voices.controller';
import { TTSController } from './controllers/tts.controller';
import { AiProviderFactory } from './ai-provider.factory';

// Use mock providers if OPENAI_API_KEY is not set (for testing)
const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim();
const hasReplicateKey = process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.trim();
const hasElevenLabsKey = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim();
const hasHuggingFaceKey = process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY.trim();
const isDevelopment = process.env.NODE_ENV !== 'production';

// Choose image-to-video provider (priority: Replicate > HuggingFace > Free)
const getImageToVideoProvider = () => {
  // Check if Replicate package is available
  let replicateAvailable = false;
  try {
    require('replicate');
    replicateAvailable = true;
  } catch (e) {
    // Replicate package not installed
  }

  if (hasReplicateKey && replicateAvailable) {
    return ReplicateImageToVideoProvider;
  } else if (hasHuggingFaceKey) {
    return HuggingFaceImageToVideoProvider;
  } else {
    return FreeImageToVideoProvider;
  }
};

import { ReplicateImageProvider } from './providers/replicate-image.provider';

@Module({
  imports: [StorageModule],
  controllers: [VoicesController, TTSController],
  providers: [
    AiProviderFactory,
    ElevenLabsService,
    // Concrete Providers
    GeminiIntentProvider,
    OpenAIScriptProvider,
    GeminiScriptProvider,
    OpenAITTSProvider,
    OpenAITTSProvider,
    ElevenLabsTTSProvider,
    GeminiTTSProvider,
    LocalCaptionProvider,
    DalleImageProvider,
    GeminiImageProvider,
    ReplicateImageToVideoProvider,
    GeminiVideoProvider,
    HuggingFaceImageToVideoProvider,
    FreeImageToVideoProvider,
    MockScriptProvider,
    MockTTSProvider,
    MockImageProvider,
    ReplicateImageProvider,

    // Default Alias Bindings (Kept for backward compat)
    {
      provide: 'IScriptGenerator',
      useClass: hasGeminiKey
        ? GeminiScriptProvider
        : hasOpenAIKey
          ? OpenAIScriptProvider
          : MockScriptProvider,
    },
    {
      provide: 'ITextToSpeech',
      useClass: hasElevenLabsKey
        ? ElevenLabsTTSProvider
        : hasOpenAIKey
          ? OpenAITTSProvider
          : MockTTSProvider,
    },
    {
      provide: 'ICaptionGenerator',
      useClass: LocalCaptionProvider,
    },
    {
      provide: 'IImageGenerator',
      useClass: hasGeminiKey
        ? GeminiImageProvider
        : hasOpenAIKey
          ? DalleImageProvider
          : MockImageProvider,
    },
    {
      provide: 'IImageToVideo',
      useClass: hasGeminiKey ? GeminiVideoProvider : getImageToVideoProvider(),
    },
  ],
  exports: [
    AiProviderFactory,
    GeminiTTSProvider,
    OpenAITTSProvider,
    ElevenLabsService,
    'IScriptGenerator',
    'ITextToSpeech',
    'ICaptionGenerator',
    'IImageGenerator',
    'IImageToVideo',
  ],
})
export class AIModule {
  constructor() {
    if (!hasOpenAIKey && !hasGeminiKey && isDevelopment) {
      console.warn('⚠️  Using MOCK AI providers (No valid API keys set for OpenAI or Gemini).');
    }
  }
}
