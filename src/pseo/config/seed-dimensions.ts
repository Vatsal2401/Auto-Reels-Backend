// ─── Phase-1 seed dimensions — single source of truth ──────────────────────

export const NICHES = [
  'finance',
  'psychology',
  'history',
  'motivation',
  'science-facts',
  'health',
  'ai-tech',
  'business',
  'philosophy',
  'nature-space',
];

export const TONES = ['motivational', 'educational', 'humorous', 'storytelling', 'controversial'];

export const PLATFORMS = ['instagram', 'youtube', 'tiktok', 'linkedin', 'facebook'];

export const PERSONAS = [
  'coaches',
  'real-estate-agents',
  'fitness-trainers',
  'marketers',
  'entrepreneurs',
  'educators',
  'content-creators',
  'youtubers',
  'instagram-influencers',
  'small-business-owners',
];

export const COUNTRIES = [
  'india',
  'united-states',
  'united-kingdom',
  'australia',
  'canada',
  'nigeria',
  'south-africa',
  'philippines',
  'indonesia',
  'brazil',
];

export const COMPETITORS = [
  'invideo',
  'canva',
  'pictory',
  'synthesia',
  'descript',
  'heygen',
  'veed',
  'capcut',
  'runway',
  'adobe-express',
];

export const INTEGRATIONS = [
  'wordpress',
  'shopify',
  'buffer',
  'hootsuite',
  'later',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'facebook',
];

export const LANGUAGES = [
  'hindi',
  'spanish',
  'french',
  'arabic',
  'portuguese',
  'german',
  'japanese',
  'indonesian',
  'bengali',
  'tamil',
];

export const GLOSSARY_TERMS = [
  'faceless-reel',
  'ai-voiceover',
  'viral-hook',
  'caption-sync',
  'kenburns-effect',
  'b-roll',
  'hook-copy',
  'voiceover',
  'text-to-speech',
  'auto-captions',
  'reel-template',
  'short-form-video',
  'faceless-channel',
  'ai-script',
  'video-automation',
  'stock-footage',
  'dynamic-subtitles',
  'talking-head',
  'faceless-youtube',
  'niche-content',
  'content-calendar',
  'viral-formula',
  'engagement-rate',
  'watch-time',
  'cta-overlay',
  'aspect-ratio',
  'vertical-video',
  'scroll-stopper',
  'pattern-interrupt',
  'content-pillar',
  'repurpose-content',
  'ai-generated-video',
  'social-media-automation',
  'content-batch',
  'video-seo',
  'thumbnail-hook',
  'voiceover-script',
  'scene-transition',
  'b-roll-footage',
  'music-sync',
  'ai-editing',
  'faceless-brand',
  'niche-down',
  'creator-economy',
  'monetization-strategy',
  'viral-content',
  'shorts-algorithm',
  'reels-algorithm',
  'tiktok-fyp',
  'content-repurposing',
];

export const TOOL_TYPES = [
  'ai-video-generator',
  'faceless-video-maker',
  'reel-creator',
  'shorts-generator',
  'tiktok-maker',
  'voiceover-tool',
  'caption-generator',
  'script-writer',
  'content-scheduler',
  'video-repurposer',
];

export const PLANS = ['starter', 'pro', 'agency'];

/** All dimensions as a flat record — used by GET /admin/pseo/seed-dimensions */
export const SEED_DIMENSIONS: Record<string, string[]> = {
  niches: NICHES,
  tones: TONES,
  platforms: PLATFORMS,
  personas: PERSONAS,
  countries: COUNTRIES,
  competitors: COMPETITORS,
  integrations: INTEGRATIONS,
  languages: LANGUAGES,
  glossary_terms: GLOSSARY_TERMS,
  tool_types: TOOL_TYPES,
  plans: PLANS,
};
