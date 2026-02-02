export interface MediaGenerationSettings {
  // Script & Language
  topic: string;
  language: string; // e.g., 'en-US', 'ja-JP'
  duration: '30-60' | '60-90' | '90-120'; // Seconds preference

  // Visuals
  imageStyle: string; // Now supports free-form prompt presets
  imageAspectRatio: '9:16' | '16:9' | '1:1';
  imageProvider: 'gemini' | 'replicate' | 'dalle' | 'mock';

  // Audio
  voiceId: string; // Provider-specific ID
}
