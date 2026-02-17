import type { WatermarkConfig } from './render-queue.service';

const DEFAULT_WATERMARK_TEXT = 'Made with AutoReels';

/**
 * Derives watermark config from user subscription at render time.
 * FREE (is_premium = false) → watermark enabled; PRO → disabled.
 * Used by media orchestrator and kinetic service; not controllable by frontend.
 */
export function getWatermarkConfig(
  isPremium: boolean,
  text = DEFAULT_WATERMARK_TEXT,
): { watermark: WatermarkConfig } {
  return {
    watermark: {
      enabled: !isPremium,
      type: 'text',
      value: text,
    },
  };
}
