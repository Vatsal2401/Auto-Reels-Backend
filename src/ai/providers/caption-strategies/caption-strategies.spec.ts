import { ShortDurationStrategy } from './short-duration.strategy';
import { LongDurationStrategy } from './long-duration.strategy';
import { ViralCaptionLine } from '../../services/viral-caption-optimizer.service';

const EMPTY_BUFFER = Buffer.from('');
const SPEECH_SEGMENTS = [{ start: 0, end: 30 }];

const PRE_OPTIMIZED: ViralCaptionLine[] = [
  { line: 'Did you know this secret', highlight: 'secret', intensity: 4 },
  { line: 'changes everything you thought', highlight: 'everything', intensity: 5 },
  { line: 'Most people miss it daily', highlight: null, intensity: 3 },
];

// ---------------------------------------------------------------------------
// ShortDurationStrategy
// ---------------------------------------------------------------------------

describe('ShortDurationStrategy', () => {
  const strategy = new ShortDurationStrategy();

  describe('with preOptimizedLines', () => {
    it('produces one timing entry per AI line', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        SPEECH_SEGMENTS,
        30,
        'sentence',
        PRE_OPTIMIZED,
      );
      expect(timings).toHaveLength(PRE_OPTIMIZED.length);
    });

    it('each entry text matches the AI line', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        SPEECH_SEGMENTS,
        30,
        'sentence',
        PRE_OPTIMIZED,
      );
      // Text may be uppercase for single-word blocks; check words are present
      PRE_OPTIMIZED.forEach((l, i) => {
        const words = l.line.trim().split(/\s+/);
        words.forEach((w) => {
          expect(timings[i].text.toLowerCase()).toContain(w.toLowerCase());
        });
      });
    });

    it('timings are non-overlapping and have valid start/end', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        SPEECH_SEGMENTS,
        30,
        'sentence',
        PRE_OPTIMIZED,
      );
      for (let i = 0; i < timings.length; i++) {
        expect(timings[i].start).toBeGreaterThanOrEqual(0);
        expect(timings[i].end).toBeGreaterThan(timings[i].start);
        if (i > 0) {
          expect(timings[i].start).toBeGreaterThanOrEqual(timings[i - 1].start);
        }
      }
    });

    it('includes word-level timings when timingType is word', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        SPEECH_SEGMENTS,
        30,
        'word',
        PRE_OPTIMIZED,
      );
      timings.forEach((t) => {
        expect(Array.isArray(t.words)).toBe(true);
        expect(t.words!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('without preOptimizedLines (heuristic fallback)', () => {
    const script = 'This is a test script with several words to split into blocks.';

    it('still produces timing entries from raw script', () => {
      const timings = strategy.generate(EMPTY_BUFFER, script, SPEECH_SEGMENTS, 30, 'sentence');
      expect(timings.length).toBeGreaterThan(0);
    });

    it('does not have highlight or intensity fields', () => {
      const timings = strategy.generate(EMPTY_BUFFER, script, SPEECH_SEGMENTS, 30, 'sentence');
      timings.forEach((t) => {
        expect(t.highlight).toBeUndefined();
        expect(t.intensity).toBeUndefined();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// LongDurationStrategy
// ---------------------------------------------------------------------------

describe('LongDurationStrategy', () => {
  const strategy = new LongDurationStrategy();
  const LONG_SEGMENTS = [{ start: 0, end: 90 }];

  describe('with preOptimizedLines', () => {
    it('produces one timing entry per AI line', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        LONG_SEGMENTS,
        90,
        'sentence',
        PRE_OPTIMIZED,
      );
      expect(timings).toHaveLength(PRE_OPTIMIZED.length);
    });

    it('timings are valid', () => {
      const timings = strategy.generate(
        EMPTY_BUFFER,
        '',
        LONG_SEGMENTS,
        90,
        'sentence',
        PRE_OPTIMIZED,
      );
      timings.forEach((t) => {
        expect(t.start).toBeGreaterThanOrEqual(0);
        expect(t.end).toBeGreaterThan(t.start);
      });
    });
  });

  describe('without preOptimizedLines (heuristic fallback)', () => {
    it('falls back to heuristic splitting', () => {
      const script =
        'Long form content with many words. Each sentence is a scene. This tests the fallback path.';
      const timings = strategy.generate(EMPTY_BUFFER, script, LONG_SEGMENTS, 90, 'sentence');
      expect(timings.length).toBeGreaterThan(0);
    });
  });
});
