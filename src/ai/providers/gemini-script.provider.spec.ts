import { GeminiScriptProvider } from './gemini-script.provider';
import { LangChainRegistry } from '../../langchain/langchain.registry';
import { ScriptGenerationOptions } from '../interfaces/script-generator.interface';

// ---------------------------------------------------------------------------
// Closures captured by jest.mock factories — assigned in beforeEach
// ---------------------------------------------------------------------------

let mockJsonInvoke: jest.Mock;
let mockSimpleInvoke: jest.Mock;

// Mock the prompt template module so we can intercept pipe() chains
jest.mock('./gemini-script.prompt', () => ({
  scriptJsonPromptTemplate: {
    pipe: jest.fn().mockImplementation(() => ({
      invoke: (...args: unknown[]) => mockJsonInvoke(...args),
    })),
  },
  scriptSimplePromptTemplate: {
    pipe: jest.fn().mockImplementation(() => ({
      pipe: jest.fn().mockImplementation(() => ({
        invoke: (...args: unknown[]) => mockSimpleInvoke(...args),
      })),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_SCRIPT_RESULT = {
  scenes: [
    {
      scene_number: 1,
      description: 'Opening scene',
      image_prompt: 'A dramatic cityscape at dawn',
      duration: 5,
      audio_text: 'This will change your life',
    },
  ],
  total_duration: 30,
  topic: 'productivity',
  visual_style: 'Cinematic',
};

function makeProvider(): { provider: GeminiScriptProvider; registry: LangChainRegistry } {
  const mockStructuredGemini = { invoke: jest.fn() };
  const mockGemini = { withRetry: jest.fn().mockReturnThis(), withStructuredOutput: jest.fn() };

  const registry = {
    getStructuredGemini: jest.fn().mockReturnValue(mockStructuredGemini),
    getGemini: jest.fn().mockReturnValue(mockGemini),
  } as unknown as LangChainRegistry;

  const provider = new GeminiScriptProvider(registry);
  return { provider, registry };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GeminiScriptProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJsonInvoke = jest.fn().mockResolvedValue(MOCK_SCRIPT_RESULT);
    mockSimpleInvoke = jest.fn().mockResolvedValue('A generated script text about productivity');
  });

  // -------------------------------------------------------------------------
  // generateScriptJSON — string topic
  // -------------------------------------------------------------------------
  describe('generateScriptJSON() — string topic', () => {
    it('returns ScriptJSON shape for a plain string topic', async () => {
      const { provider } = makeProvider();

      const result = await provider.generateScriptJSON('productivity hacks');

      expect(result).toBeDefined();
      expect(result.scenes).toHaveLength(1);
      expect(result.total_duration).toBe(30);
      expect(result.topic).toBe('productivity');
    });

    it('invokes the chain with a systemPrompt and userMessage containing the topic', async () => {
      const { provider } = makeProvider();

      await provider.generateScriptJSON('meditation');

      expect(mockJsonInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.any(String),
          userMessage: expect.stringContaining('meditation'),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateScriptJSON — ScriptGenerationOptions object
  // -------------------------------------------------------------------------
  describe('generateScriptJSON() — ScriptGenerationOptions', () => {
    it('uses all provided options when invoking chain', async () => {
      const { provider } = makeProvider();
      const options: ScriptGenerationOptions = {
        topic: 'morning routines',
        language: 'Spanish',
        targetDurationSeconds: 60,
        audioPrompt: 'calm and clear',
        visualStyle: 'Minimalist',
        tone: 'motivational',
        hookType: 'bold_question',
        cta: 'follow',
      };

      await provider.generateScriptJSON(options);

      // The systemPrompt should be constructed using the provided options
      expect(mockJsonInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.any(String),
          userMessage: expect.stringContaining('morning routines'),
        }),
      );
    });

    it('falls back to defaults for missing optional fields', async () => {
      const { provider } = makeProvider();
      const options: ScriptGenerationOptions = { topic: 'fitness tips' };

      const result = await provider.generateScriptJSON(options);

      expect(result).toBeDefined();
      expect(mockJsonInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('fitness tips'),
        }),
      );
    });

    it('includes visual style in the userMessage', async () => {
      const { provider } = makeProvider();
      const options: ScriptGenerationOptions = {
        topic: 'space exploration',
        visualStyle: 'Anime',
      };

      await provider.generateScriptJSON(options);

      expect(mockJsonInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('Anime'),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateScript
  // -------------------------------------------------------------------------
  describe('generateScript()', () => {
    it('returns a string result from the chain', async () => {
      const { provider } = makeProvider();

      const result = await provider.generateScript('travel tips');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('resolves with the value from the chain invoke', async () => {
      const expectedScript = 'A generated script text about productivity';
      mockSimpleInvoke.mockResolvedValue(expectedScript);
      const { provider } = makeProvider();

      const result = await provider.generateScript('productivity');

      expect(result).toBe(expectedScript);
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------
  describe('error propagation', () => {
    it('generateScriptJSON re-throws when chain throws', async () => {
      mockJsonInvoke = jest.fn().mockRejectedValue(new Error('Gemini quota exceeded'));
      const { provider } = makeProvider();

      await expect(provider.generateScriptJSON('any topic')).rejects.toThrow(
        'Gemini quota exceeded',
      );
    });

    it('generateScript re-throws when chain throws', async () => {
      mockSimpleInvoke = jest.fn().mockRejectedValue(new Error('Network timeout'));
      const { provider } = makeProvider();

      await expect(provider.generateScript('any topic')).rejects.toThrow('Network timeout');
    });
  });
});
