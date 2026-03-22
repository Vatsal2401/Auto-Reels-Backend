import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ZodSchema } from 'zod';
import { GEMINI_FLASH, GPT_4O } from './langchain.config';

@Injectable()
export class LangChainRegistry {
  private readonly logger = new Logger(LangChainRegistry.name);
  private readonly geminiInstances = new Map<string, ChatGoogleGenerativeAI>();
  private readonly openaiInstances = new Map<string, ChatOpenAI>();

  constructor(private readonly configService: ConfigService) {}

  getGemini(modelName = GEMINI_FLASH, temperature = 0.3): ChatGoogleGenerativeAI {
    const key = `${modelName}:${temperature}`;
    if (!this.geminiInstances.has(key)) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        this.logger.warn(`GEMINI_API_KEY not set — ${modelName} will fail on invoke`);
      }
      const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: apiKey ?? '',
        temperature,
        maxOutputTokens: 8192,
      });
      // Retry on transient errors (429, 503, network); fail fast on 400/401
      this.geminiInstances.set(
        key,
        model.withRetry({
          stopAfterAttempt: 3,
          onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
            this.logger.warn(`Gemini retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
          },
        }) as unknown as ChatGoogleGenerativeAI,
      );
    }
    return this.geminiInstances.get(key)!;
  }

  getOpenAI(modelName = GPT_4O, temperature = 0.8): ChatOpenAI {
    const key = `${modelName}:${temperature}`;
    if (!this.openaiInstances.has(key)) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        this.logger.warn(`OPENAI_API_KEY not set — ${modelName} will fail on invoke`);
      }
      const model = new ChatOpenAI({
        model: modelName,
        apiKey: apiKey ?? '',
        temperature,
        maxTokens: 8192,
      });
      this.openaiInstances.set(
        key,
        model.withRetry({
          stopAfterAttempt: 3,
          onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
            this.logger.warn(`OpenAI retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
          },
        }) as unknown as ChatOpenAI,
      );
    }
    return this.openaiInstances.get(key)!;
  }

  // Use for all structured JSON outputs — eliminates JSON.parse + sanitizeGeminiJson
  getStructuredGemini<T extends ZodSchema>(schema: T, modelName = GEMINI_FLASH, temperature = 0.3) {
    return this.getGemini(modelName, temperature).withStructuredOutput(schema);
  }

  getStructuredOpenAI<T extends ZodSchema>(schema: T, modelName = GPT_4O, temperature = 0.8) {
    return this.getOpenAI(modelName, temperature).withStructuredOutput(schema);
  }
}
