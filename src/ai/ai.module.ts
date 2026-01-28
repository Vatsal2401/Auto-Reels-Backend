import { Module } from '@nestjs/common';
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
import { ReplicateCaptionProvider } from './providers/replicate-caption.provider';
import { DalleImageProvider } from './providers/dalle-image.provider';
import { ReplicateImageToVideoProvider } from './providers/replicate-image-to-video.provider';
import { HuggingFaceImageToVideoProvider } from './providers/huggingface-image-to-video.provider';
import { FreeImageToVideoProvider } from './providers/free-image-to-video.provider';
import { GeminiScriptProvider } from './providers/gemini-script.provider';
import { AiProviderFactory } from './ai-provider.factory';

// Use mock providers if OPENAI_API_KEY is not set (for testing)
const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim();
const hasReplicateKey = process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.trim();
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

@Module({
  providers: [
    AiProviderFactory,
    // Concrete Providers
    OpenAIScriptProvider,
    GeminiScriptProvider,
    OpenAITTSProvider,
    ReplicateCaptionProvider,
    DalleImageProvider,
    ReplicateImageToVideoProvider,
    HuggingFaceImageToVideoProvider,
    FreeImageToVideoProvider,
    MockScriptProvider,
    MockTTSProvider,
    MockImageProvider,

    // Default Alias Bindings (Kept for backward compat)
    {
      provide: 'IScriptGenerator',
      useClass: hasOpenAIKey ? OpenAIScriptProvider : (hasGeminiKey ? GeminiScriptProvider : MockScriptProvider),
    },
    {
      provide: 'ITextToSpeech',
      useClass: hasOpenAIKey ? OpenAITTSProvider : MockTTSProvider,
    },
    {
      provide: 'ICaptionGenerator',
      useClass: ReplicateCaptionProvider,
    },
    {
      provide: 'IImageGenerator',
      useClass: hasOpenAIKey ? DalleImageProvider : MockImageProvider,
    },
    {
      provide: 'IImageToVideo',
      useClass: getImageToVideoProvider(),
    },
  ],
  exports: [
    AiProviderFactory,
    'IScriptGenerator', 'ITextToSpeech', 'ICaptionGenerator', 'IImageGenerator', 'IImageToVideo'
  ],
})
export class AIModule {
  constructor() {
    if (!hasOpenAIKey && isDevelopment) {
      console.warn('⚠️  Using MOCK AI providers (no OPENAI_API_KEY set). Set OPENAI_API_KEY for real AI features.');
    }
  }
}
