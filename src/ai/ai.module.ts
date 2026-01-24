import { Module } from '@nestjs/common';
import { IScriptGenerator } from './interfaces/script-generator.interface';
import { ITextToSpeech } from './interfaces/text-to-speech.interface';
import { ICaptionGenerator } from './interfaces/caption-generator.interface';
import { OpenAIScriptProvider } from './providers/openai-script.provider';
import { OpenAITTSProvider } from './providers/openai-tts.provider';
import { ReplicateCaptionProvider } from './providers/replicate-caption.provider';

@Module({
  providers: [
    {
      provide: 'IScriptGenerator',
      useClass: OpenAIScriptProvider,
    },
    {
      provide: 'ITextToSpeech',
      useClass: OpenAITTSProvider,
    },
    {
      provide: 'ICaptionGenerator',
      useClass: ReplicateCaptionProvider,
    },
  ],
  exports: ['IScriptGenerator', 'ITextToSpeech', 'ICaptionGenerator'],
})
export class AIModule {}
