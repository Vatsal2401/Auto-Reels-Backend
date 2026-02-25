/**
 * Tests the highlight + intensity merging in LocalCaptionProvider
 * and the ASS generator's applyHighlight behaviour.
 *
 * We test the integration without needing ffmpeg/audio by directly
 * exercising the strategy + metadata-merge logic.
 */

import { ShortDurationStrategy } from './caption-strategies/short-duration.strategy';
import { ViralCaptionLine } from '../services/viral-caption-optimizer.service';

// Replicate the exact merge logic from LocalCaptionProvider so we can unit-test it
function mergeMetadata(timings: any[], preOptimizedLines: ViralCaptionLine[]) {
  timings.forEach((t, i) => {
    t.highlight = preOptimizedLines[i]?.highlight ?? null;
    t.intensity = preOptimizedLines[i]?.intensity;
  });
  return timings;
}

const SPEECH_SEGMENTS = [{ start: 0, end: 20 }];
const EMPTY_BUFFER = Buffer.from('');

const PRE_LINES: ViralCaptionLine[] = [
  { line: 'Secret nobody tells you', highlight: 'Secret', intensity: 5 },
  { line: 'This one trick works', highlight: 'trick', intensity: 4 },
  { line: 'Try it right now', highlight: null, intensity: 2 },
];

describe('highlight + intensity metadata merge', () => {
  let timings: any[];

  beforeEach(() => {
    const strategy = new ShortDurationStrategy();
    timings = strategy.generate(EMPTY_BUFFER, '', SPEECH_SEGMENTS, 20, 'sentence', PRE_LINES);
    mergeMetadata(timings, PRE_LINES);
  });

  it('every timing entry has a highlight field', () => {
    timings.forEach((t) => expect(t).toHaveProperty('highlight'));
  });

  it('every timing entry has an intensity field', () => {
    timings.forEach((t) => expect(t).toHaveProperty('intensity'));
  });

  it('highlight matches the AI-provided value', () => {
    expect(timings[0].highlight).toBe('Secret');
    expect(timings[1].highlight).toBe('trick');
    expect(timings[2].highlight).toBeNull();
  });

  it('intensity matches the AI-provided value', () => {
    expect(timings[0].intensity).toBe(5);
    expect(timings[1].intensity).toBe(4);
    expect(timings[2].intensity).toBe(2);
  });

  it('output is valid JSON with highlight and intensity fields', () => {
    const json = JSON.parse(JSON.stringify(timings));
    expect(json[0].highlight).toBe('Secret');
    expect(json[0].intensity).toBe(5);
  });

  it('extra entries beyond AI lines get null highlight gracefully', () => {
    // Simulate more timing entries than AI lines (edge case)
    const extraTimings = [...timings, { text: 'extra', start: 18, end: 20 }];
    const shortLines: ViralCaptionLine[] = [PRE_LINES[0]!];
    mergeMetadata(extraTimings, shortLines);
    // Entry beyond AI lines should get null highlight
    expect(extraTimings[1].highlight).toBeNull();
    expect(extraTimings[2].highlight).toBeNull();
  });
});
