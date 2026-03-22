// Mock ChatPromptTemplate before the service is imported.
// The system prompt contains JSON examples with lone `}` characters, which
// LangChain's f-string parser rejects. Mocking at module level bypasses the
// real parser entirely so the service can be instantiated in tests.
jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({ invoke: jest.fn() }),
    }),
  },
}));

import { ViralCaptionOptimizerService } from './viral-caption-optimizer.service';
import { LangChainRegistry } from '../../langchain/langchain.registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(chainResult: any, shouldThrow = false) {
  const mockInvoke = shouldThrow
    ? jest.fn().mockRejectedValue(new Error('API error'))
    : jest.fn().mockResolvedValue(chainResult);

  const mockRegistry = {
    getStructuredGemini: jest.fn().mockReturnValue({ invoke: mockInvoke }),
  } as unknown as LangChainRegistry;

  const svc = new ViralCaptionOptimizerService(mockRegistry);
  // Replace the chain built at field-initializer time with a direct mock
  (svc as any).chain = { invoke: mockInvoke };

  return { svc, mockInvoke };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_RESULT = {
  hook_strength: 8,
  captions: [
    { line: 'Did you know this', highlight: 'know', intensity: 4 },
    { line: 'changes everything', highlight: 'everything', intensity: 5 },
    { line: 'Most people miss it', highlight: null, intensity: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViralCaptionOptimizerService', () => {
  describe('optimize() — happy path', () => {
    it('returns hook_strength and captions array', async () => {
      const { svc } = makeService(VALID_RESULT);

      const result = await svc.optimize(
        'Did you know this changes everything? Most people miss it.',
      );

      expect(result).not.toBeNull();
      expect(result!.hook_strength).toBe(8);
      expect(result!.captions).toHaveLength(3);
    });

    it('each caption has line, highlight, intensity', async () => {
      const { svc } = makeService(VALID_RESULT);

      const result = await svc.optimize('Did you know this changes everything?');

      const first = result!.captions[0];
      expect(first).toHaveProperty('line');
      expect(first).toHaveProperty('highlight');
      expect(first).toHaveProperty('intensity');
      expect(typeof first.intensity).toBe('number');
    });

    it('strips markdown bold (**text**) from caption lines', async () => {
      const boldResult = {
        hook_strength: 7,
        captions: [{ line: '**This** is huge', highlight: 'huge', intensity: 4 }],
      };
      const { svc } = makeService(boldResult);

      const result = await svc.optimize('This is huge.');

      expect(result!.captions[0].line).toBe('This is huge');
    });

    it('strips markdown italic (*text*) from caption lines', async () => {
      const italicResult = {
        hook_strength: 6,
        captions: [{ line: '*incredible* power', highlight: 'power', intensity: 3 }],
      };
      const { svc } = makeService(italicResult);

      const result = await svc.optimize('incredible power');

      expect(result!.captions[0].line).toBe('incredible power');
    });

    it('strips markdown underline (__text__) from caption lines', async () => {
      const underlineResult = {
        hook_strength: 5,
        captions: [{ line: '__key__ insight', highlight: 'insight', intensity: 2 }],
      };
      const { svc } = makeService(underlineResult);

      const result = await svc.optimize('key insight');

      expect(result!.captions[0].line).toBe('key insight');
    });

    it('strips markdown underscore italic (_text_) from caption lines', async () => {
      const italicUnderscoreResult = {
        hook_strength: 5,
        captions: [{ line: '_amazing_ fact', highlight: 'fact', intensity: 3 }],
      };
      const { svc } = makeService(italicUnderscoreResult);

      const result = await svc.optimize('amazing fact');

      expect(result!.captions[0].line).toBe('amazing fact');
    });

    it('passes the transcript to chain.invoke', async () => {
      const { svc, mockInvoke } = makeService(VALID_RESULT);
      const script = 'test script content';

      await svc.optimize(script);

      expect(mockInvoke).toHaveBeenCalledWith({ transcript: script });
    });

    it('trims whitespace from script before invoking chain', async () => {
      const { svc, mockInvoke } = makeService(VALID_RESULT);

      await svc.optimize('  spaced out script  ');

      expect(mockInvoke).toHaveBeenCalledWith({ transcript: 'spaced out script' });
    });
  });

  describe('optimize() — graceful fallback', () => {
    it('returns null when chain throws', async () => {
      const { svc } = makeService(null, true /* shouldThrow */);

      const result = await svc.optimize('some script');

      expect(result).toBeNull();
    });

    it('returns null for empty script text', async () => {
      const { svc, mockInvoke } = makeService(VALID_RESULT);

      const result = await svc.optimize('');

      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('returns null for whitespace-only script text', async () => {
      const { svc, mockInvoke } = makeService(VALID_RESULT);

      const result = await svc.optimize('   ');

      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
