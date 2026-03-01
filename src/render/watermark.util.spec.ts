import { getWatermarkConfig } from './watermark.util';

describe('getWatermarkConfig', () => {
  it('enables watermark for FREE users (is_premium = false)', () => {
    const { watermark } = getWatermarkConfig(false);
    expect(watermark.enabled).toBe(true);
    expect(watermark.type).toBe('text');
    expect(watermark.value).toBe('Made with autoreels.in');
  });

  it('disables watermark for PRO users (is_premium = true)', () => {
    const { watermark } = getWatermarkConfig(true);
    expect(watermark.enabled).toBe(false);
    expect(watermark.type).toBe('text');
    expect(watermark.value).toBe('Made with autoreels.in');
  });

  it('uses custom text when provided', () => {
    const { watermark } = getWatermarkConfig(false, 'Custom Brand');
    expect(watermark.enabled).toBe(true);
    expect(watermark.value).toBe('Custom Brand');
  });
});
