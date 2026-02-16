import type { TemplateStyle, TemplateStyleConfig } from '../interfaces/graphic-motion.interface';

/**
 * Template style presets. Deterministic; no random.
 * Applied consistently across all scenes in one video.
 */
export const TEMPLATE_STYLE_CONFIGS: Record<TemplateStyle, TemplateStyleConfig> = {
  minimal: {
    background: { type: 'flat-light', primary: '#FAFAFA' },
    typography: { fontScaleMultiplier: 1, headlineWeight: 700 },
    motion: { intensity: 0.4 },
    accent: { color: '#0F172A', showBar: true },
    textColors: { headline: '#0F172A', subhead: '#475569', label: '#64748B' },
  },
  bold: {
    background: { type: 'flat-dark', primary: '#0F172A' },
    typography: { fontScaleMultiplier: 1.08, headlineWeight: 800 },
    motion: { intensity: 0.65 },
    accent: { color: '#F97316', showBar: true },
    textColors: { headline: '#FAFAFA', subhead: '#D4D4D8', label: '#A1A1AA' },
  },
  corporate: {
    background: { type: 'gradient-soft', primary: '#F8FAFC', secondary: '#E2E8F0' },
    typography: { fontScaleMultiplier: 0.98, headlineWeight: 700 },
    motion: { intensity: 0.35 },
    accent: { color: '#0369A1', showBar: true },
    textColors: { headline: '#0F172A', subhead: '#475569', label: '#64748B' },
  },
};

export function getTemplateStyleConfig(style: TemplateStyle): TemplateStyleConfig {
  return TEMPLATE_STYLE_CONFIGS[style] ?? TEMPLATE_STYLE_CONFIGS.minimal;
}
