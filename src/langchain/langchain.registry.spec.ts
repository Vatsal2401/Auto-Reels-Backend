import { ConfigService } from '@nestjs/config';
import { LangChainRegistry } from './langchain.registry';
import { GEMINI_FLASH, GPT_4O } from './langchain.config';

// ---------------------------------------------------------------------------
// Module-level mocks — must be at the top before any imports of these modules
// ---------------------------------------------------------------------------

// Each constructor call returns a NEW object so that singleton-cache tests
// (same key → same ref) and distinctness tests (different key → different ref)
// both work correctly.
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => {
    const instance = {
      withRetry: jest.fn(),
      withStructuredOutput: jest.fn(),
    };
    // withRetry returns a fresh wrapper that also has withStructuredOutput
    instance.withRetry.mockReturnValue({
      withStructuredOutput: instance.withStructuredOutput,
    });
    return instance;
  }),
}));

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => {
    const instance = {
      withRetry: jest.fn(),
      withStructuredOutput: jest.fn(),
    };
    instance.withRetry.mockReturnValue({
      withStructuredOutput: instance.withStructuredOutput,
    });
    return instance;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(geminiKey?: string, openaiKey?: string): LangChainRegistry {
  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') return geminiKey;
      if (key === 'OPENAI_API_KEY') return openaiKey;
      return undefined;
    }),
  } as unknown as ConfigService;

  return new LangChainRegistry(configService);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LangChainRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getGemini — singleton cache
  // -------------------------------------------------------------------------
  describe('getGemini()', () => {
    it('returns the same instance for the same model + temperature', () => {
      const registry = makeRegistry('gemini-key');

      const first = registry.getGemini(GEMINI_FLASH, 0.3);
      const second = registry.getGemini(GEMINI_FLASH, 0.3);

      expect(first).toBe(second);
    });

    it('returns different instances for different temperatures', () => {
      const registry = makeRegistry('gemini-key');

      const lowTemp = registry.getGemini(GEMINI_FLASH, 0.1);
      const highTemp = registry.getGemini(GEMINI_FLASH, 0.9);

      expect(lowTemp).not.toBe(highTemp);
    });

    it('returns different instances for different model names', () => {
      const registry = makeRegistry('gemini-key');

      const flash = registry.getGemini('gemini-2.0-flash', 0.3);
      const pro = registry.getGemini('gemini-1.5-pro', 0.3);

      expect(flash).not.toBe(pro);
    });

    it('does NOT throw when GEMINI_API_KEY is missing', () => {
      const registry = makeRegistry(undefined);
      expect(() => registry.getGemini()).not.toThrow();
    });

    it('uses GEMINI_FLASH as the default model', () => {
      const { ChatGoogleGenerativeAI } = jest.requireMock('@langchain/google-genai');
      const registry = makeRegistry('gemini-key');

      registry.getGemini();

      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith(
        expect.objectContaining({ model: GEMINI_FLASH }),
      );
    });

    it('calls withRetry on the created model', () => {
      const { ChatGoogleGenerativeAI } = jest.requireMock('@langchain/google-genai');
      const registry = makeRegistry('gemini-key');
      registry.getGemini();
      const instance = ChatGoogleGenerativeAI.mock.results[0].value;
      expect(instance.withRetry).toHaveBeenCalledWith(
        expect.objectContaining({ stopAfterAttempt: 3 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getOpenAI — singleton cache
  // -------------------------------------------------------------------------
  describe('getOpenAI()', () => {
    it('returns the same instance for the same model + temperature', () => {
      const registry = makeRegistry(undefined, 'openai-key');

      const first = registry.getOpenAI(GPT_4O, 0.8);
      const second = registry.getOpenAI(GPT_4O, 0.8);

      expect(first).toBe(second);
    });

    it('returns different instances for different temperatures', () => {
      const registry = makeRegistry(undefined, 'openai-key');

      const lowTemp = registry.getOpenAI(GPT_4O, 0.2);
      const highTemp = registry.getOpenAI(GPT_4O, 0.9);

      expect(lowTemp).not.toBe(highTemp);
    });

    it('returns different instances for different model names', () => {
      const registry = makeRegistry(undefined, 'openai-key');

      const gpt4o = registry.getOpenAI('gpt-4o', 0.8);
      const gpt4mini = registry.getOpenAI('gpt-4o-mini', 0.8);

      expect(gpt4o).not.toBe(gpt4mini);
    });

    it('does NOT throw when OPENAI_API_KEY is missing', () => {
      const registry = makeRegistry(undefined, undefined);
      expect(() => registry.getOpenAI()).not.toThrow();
    });

    it('uses GPT_4O as the default model', () => {
      const { ChatOpenAI } = jest.requireMock('@langchain/openai');
      const registry = makeRegistry(undefined, 'openai-key');

      registry.getOpenAI();

      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ model: GPT_4O }),
      );
    });

    it('calls withRetry on the created model', () => {
      const { ChatOpenAI } = jest.requireMock('@langchain/openai');
      const registry = makeRegistry(undefined, 'openai-key');
      registry.getOpenAI();
      const instance = ChatOpenAI.mock.results[0].value;
      expect(instance.withRetry).toHaveBeenCalledWith(
        expect.objectContaining({ stopAfterAttempt: 3 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getStructuredGemini — delegates to getGemini().withStructuredOutput
  // -------------------------------------------------------------------------
  describe('getStructuredGemini()', () => {
    it('calls withStructuredOutput on the cached gemini model with the provided schema', () => {
      const { ChatGoogleGenerativeAI } = jest.requireMock('@langchain/google-genai');
      const fakeStructured = { invoke: jest.fn() };

      const registry = makeRegistry('gemini-key');
      const schema = { parse: jest.fn() } as any;

      // Trigger first-time construction so mock.results is populated
      registry.getGemini();

      const instance = ChatGoogleGenerativeAI.mock.results[0].value;
      const retried = instance.withRetry.mock.results[0].value;
      retried.withStructuredOutput.mockReturnValue(fakeStructured);

      const result = registry.getStructuredGemini(schema);

      expect(retried.withStructuredOutput).toHaveBeenCalledWith(schema);
      expect(result).toBe(fakeStructured);
    });
  });

  // -------------------------------------------------------------------------
  // getStructuredOpenAI — delegates to getOpenAI().withStructuredOutput
  // -------------------------------------------------------------------------
  describe('getStructuredOpenAI()', () => {
    it('calls withStructuredOutput on the cached openai model with the provided schema', () => {
      const { ChatOpenAI } = jest.requireMock('@langchain/openai');
      const fakeStructured = { invoke: jest.fn() };

      const registry = makeRegistry(undefined, 'openai-key');
      const schema = { parse: jest.fn() } as any;

      // Trigger first-time construction so mock.results is populated
      registry.getOpenAI();

      const instance = ChatOpenAI.mock.results[0].value;
      const retried = instance.withRetry.mock.results[0].value;
      retried.withStructuredOutput.mockReturnValue(fakeStructured);

      const result = registry.getStructuredOpenAI(schema);

      expect(retried.withStructuredOutput).toHaveBeenCalledWith(schema);
      expect(result).toBe(fakeStructured);
    });
  });
});
