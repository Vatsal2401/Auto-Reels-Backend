import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ZodSchema } from 'zod';
import { GEMINI_FLASH, GPT_4O } from './langchain.config';

@Injectable()
export class LangChainRegistry {
  private readonly logger = new Logger(LangChainRegistry.name);
  // Raw model instances — .withRetry() wraps these on the way out
  private readonly geminiRaw = new Map<string, ChatGoogleGenerativeAI>();
  private readonly openaiRaw = new Map<string, ChatOpenAI>();

  constructor(private readonly configService: ConfigService) {}

  private getRawGemini(modelName: string, temperature: number): ChatGoogleGenerativeAI {
    const key = `${modelName}:${temperature}`;
    if (!this.geminiRaw.has(key)) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        this.logger.warn(`GEMINI_API_KEY not set — ${modelName} will fail on invoke`);
      }
      this.geminiRaw.set(
        key,
        new ChatGoogleGenerativeAI({ model: modelName, apiKey: apiKey ?? '', temperature, maxOutputTokens: 8192 }),
      );
    }
    return this.geminiRaw.get(key)!;
  }

  private getRawOpenAI(modelName: string, temperature: number): ChatOpenAI {
    const key = `${modelName}:${temperature}`;
    if (!this.openaiRaw.has(key)) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        this.logger.warn(`OPENAI_API_KEY not set — ${modelName} will fail on invoke`);
      }
      this.openaiRaw.set(
        key,
        new ChatOpenAI({ model: modelName, apiKey: apiKey ?? '', temperature, maxTokens: 8192 }),
      );
    }
    return this.openaiRaw.get(key)!;
  }

  // Plain text / StringOutputParser chains
  getGemini(modelName = GEMINI_FLASH, temperature = 0.3) {
    return this.getRawGemini(modelName, temperature).withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
        this.logger.warn(`Gemini retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
      },
    });
  }

  getOpenAI(modelName = GPT_4O, temperature = 0.8) {
    return this.getRawOpenAI(modelName, temperature).withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
        this.logger.warn(`OpenAI retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
      },
    });
  }

  // Structured JSON output — withStructuredOutput() must be called on the raw model
  // (RunnableSequence does not expose .withRetry(); retry is handled by service-level try/catch)
  getStructuredGemini<T extends ZodSchema>(schema: T, modelName = GEMINI_FLASH, temperature = 0.3) {
    return this.getRawGemini(modelName, temperature).withStructuredOutput(schema);
  }

  getStructuredOpenAI<T extends ZodSchema>(schema: T, modelName = GPT_4O, temperature = 0.8) {
    return this.getRawOpenAI(modelName, temperature).withStructuredOutput(schema);
  }
}
