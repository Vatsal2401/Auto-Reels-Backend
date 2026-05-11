import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ZodSchema } from 'zod';
import { GEMINI_FLASH, GPT_4O } from './langchain.config';

// LangChain Registry — AI models (Gemini, OpenAI) ના instances manage કરે છે
// Singleton pattern: એક જ model instance cache કરે, ફરી ફરી create ન કરે
@Injectable()
export class LangChainRegistry {
  private readonly logger = new Logger(LangChainRegistry.name);

  // Cache: model name + temperature ના based instances store કરે
  private readonly geminiRaw = new Map<string, ChatGoogleGenerativeAI>();
  private readonly openaiRaw = new Map<string, ChatOpenAI>();

  constructor(private readonly configService: ConfigService) {}

  // Gemini model instance return કરે (cache hit હોય તો existing return)
  private getRawGemini(modelName: string, temperature: number): ChatGoogleGenerativeAI {
    const key = `${modelName}:${temperature}`;
    if (!this.geminiRaw.has(key)) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        this.logger.warn(`GEMINI_API_KEY not set — ${modelName} will fail on invoke`);
      }
      this.geminiRaw.set(
        key,
        new ChatGoogleGenerativeAI({
          model: modelName,
          apiKey: apiKey ?? '',
          temperature,
          // 65536 tokens: thinking model (gemini-flash-latest) ને output tokens વધારે જોઈએ
          // thinking tokens output budget ખાઈ જાય છે, તેથી limit ઊંચી રાખો
          maxOutputTokens: 65536,
        }),
      );
    }
    return this.geminiRaw.get(key)!;
  }

  // OpenAI model instance return કરે (cache hit હોય તો existing return)
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

  // Plain text output માટે Gemini model return કરે (retry wrapper સાથે)
  getGemini(modelName = GEMINI_FLASH, temperature = 0.3) {
    return this.getRawGemini(modelName, temperature).withRetry({
      stopAfterAttempt: 3, // max 3 વાર retry
      onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
        this.logger.warn(`Gemini retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
      },
    });
  }

  // Plain text output માટે OpenAI model return કરે (retry wrapper સાથે)
  getOpenAI(modelName = GPT_4O, temperature = 0.8) {
    return this.getRawOpenAI(modelName, temperature).withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (err: Error & { attemptNumber?: number }) => {
        this.logger.warn(`OpenAI retry (attempt ${err.attemptNumber ?? '?'}): ${err.message}`);
      },
    });
  }

  // Structured JSON output માટે Gemini return કરે (Zod schema enforce)
  // withStructuredOutput() raw model પર call થવો જ જોઈએ (chain પર નહીં)
  getStructuredGemini<T extends ZodSchema>(schema: T, modelName = GEMINI_FLASH, temperature = 0.3) {
    return this.getRawGemini(modelName, temperature).withStructuredOutput(schema);
  }

  // Structured JSON output માટે OpenAI return કરે (Zod schema enforce)
  getStructuredOpenAI<T extends ZodSchema>(schema: T, modelName = GPT_4O, temperature = 0.8) {
    return this.getRawOpenAI(modelName, temperature).withStructuredOutput(schema);
  }
}
