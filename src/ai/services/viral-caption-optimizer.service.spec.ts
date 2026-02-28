import { ViralCaptionOptimizerService } from './viral-caption-optimizer.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(responseText: string | null) {
  const mockModel =
    responseText !== null
      ? {
          generateContent: jest.fn().mockResolvedValue({
            response: { text: () => responseText },
          }),
        }
      : null;

  const configService = {
    get: jest.fn().mockReturnValue(responseText !== null ? 'fake-key' : undefined),
  } as any;
  const svc = new ViralCaptionOptimizerService(configService);
  // Bypass constructor model init and inject mock directly
  (svc as any).model = mockModel;
  return { svc, mockModel };
}

const VALID_RESPONSE = JSON.stringify({
  hook_strength: 8,
  captions: [
    { line: 'Did you know this', highlight: 'know', intensity: 4 },
    { line: 'changes everything', highlight: 'everything', intensity: 5 },
    { line: 'Most people miss it', highlight: null, intensity: 3 },
  ],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViralCaptionOptimizerService', () => {
  describe('optimize() — happy path', () => {
    it('returns hook_strength and captions array', async () => {
      const { svc } = makeService(VALID_RESPONSE);
      const result = await svc.optimize(
        'Did you know this changes everything? Most people miss it.',
      );

      expect(result).not.toBeNull();
      expect(result!.hook_strength).toBe(8);
      expect(result!.captions).toHaveLength(3);
    });

    it('each caption has line, highlight, intensity', async () => {
      const { svc } = makeService(VALID_RESPONSE);
      const result = await svc.optimize('Did you know this changes everything?');

      const first = result!.captions[0];
      expect(first).toHaveProperty('line');
      expect(first).toHaveProperty('highlight');
      expect(first).toHaveProperty('intensity');
      expect(typeof first.intensity).toBe('number');
    });

    it('strips markdown code fences before parsing', async () => {
      const fenced = '```json\n' + VALID_RESPONSE + '\n```';
      const { svc } = makeService(fenced);
      const result = await svc.optimize('test script');
      expect(result).not.toBeNull();
      expect(result!.captions).toHaveLength(3);
    });
  });

  describe('optimize() — graceful fallback', () => {
    it('returns null when model is not initialized (no API key)', async () => {
      const { svc } = makeService(null);
      // model is already null from makeService(null)
      const result = await svc.optimize('some script');
      expect(result).toBeNull();
    });

    it('returns null on invalid JSON from Gemini', async () => {
      const { svc } = makeService('not valid json at all');
      const result = await svc.optimize('some script');
      expect(result).toBeNull();
    });

    it('returns null when JSON has wrong shape (missing captions)', async () => {
      const { svc } = makeService(JSON.stringify({ hook_strength: 5 }));
      const result = await svc.optimize('some script');
      expect(result).toBeNull();
    });

    it('returns null when captions array is empty', async () => {
      const { svc } = makeService(JSON.stringify({ hook_strength: 5, captions: [] }));
      const result = await svc.optimize('some script');
      expect(result).toBeNull();
    });

    it('returns null when Gemini throws', async () => {
      const { svc, mockModel } = makeService(VALID_RESPONSE);
      mockModel!.generateContent.mockRejectedValue(new Error('API quota exceeded'));
      const result = await svc.optimize('some script');
      expect(result).toBeNull();
    });

    it('returns null for empty script text', async () => {
      const { svc } = makeService(VALID_RESPONSE);
      const result = await svc.optimize('');
      expect(result).toBeNull();
    });
  });
});
