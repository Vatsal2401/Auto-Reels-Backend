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
  neon: {
    background: { type: 'flat-dark', primary: '#0A0A0F' },
    typography: { fontScaleMultiplier: 1.1, headlineWeight: 800 },
    motion: { intensity: 0.7 },
    accent: { color: '#00FFC6', showBar: true, glowIntensity: 0.8 },
    textColors: { headline: '#FFFFFF', subhead: '#B0FFE8', label: '#6BFFD4' },
  },
  editorial: {
    background: { type: 'flat-light', primary: '#F2EDE7' },
    typography: { fontScaleMultiplier: 0.95, headlineWeight: 700 },
    motion: { intensity: 0.3 },
    accent: { color: '#B45309', showBar: true },
    textColors: { headline: '#1C1917', subhead: '#57534E', label: '#78716C' },
  },
  'gradient-pop': {
    background: { type: 'animated-gradient', primary: '#1E1B4B', secondary: '#7C3AED' },
    typography: { fontScaleMultiplier: 1.05, headlineWeight: 800 },
    motion: { intensity: 0.6 },
    accent: { color: '#A78BFA', showBar: true },
    textColors: { headline: '#FFFFFF', subhead: '#DDD6FE', label: '#C4B5FD' },
  },
  'dark-luxury': {
    background: { type: 'radial-glow', primary: '#050505', secondary: '#1A1500' },
    typography: { fontScaleMultiplier: 1.02, headlineWeight: 700 },
    motion: { intensity: 0.45 },
    accent: { color: '#D4AF37', showBar: true, glowIntensity: 0.5 },
    textColors: { headline: '#F5F0E8', subhead: '#C8B888', label: '#968763' },
  },
  'pastel-soft': {
    background: { type: 'dot-grid', primary: '#FEF3F2' },
    typography: { fontScaleMultiplier: 1.0, headlineWeight: 700 },
    motion: { intensity: 0.35 },
    accent: { color: '#FB7185', showBar: true },
    textColors: { headline: '#1E0A10', subhead: '#6B2A36', label: '#9F4255' },
  },
};

export function getTemplateStyleConfig(style: TemplateStyle): TemplateStyleConfig {
  return TEMPLATE_STYLE_CONFIGS[style] ?? TEMPLATE_STYLE_CONFIGS.minimal;
}
