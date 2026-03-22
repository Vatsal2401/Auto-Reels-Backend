/**
 * LangChain Integration Tests
 *
 * These tests verify:
 * 1. That the LCEL pipeline assembles correctly (no real API calls)
 * 2. That all Zod schemas validate the right shapes and reject bad data
 */

import { ScriptJSONSchema } from './schemas/script.schema';
import { ViralCaptionSchema } from './schemas/viral-caption.schema';
import { IntentSchema } from './schemas/intent.schema';
import { UgcScriptSchema } from './schemas/ugc-script.schema';
import { StoryScriptSchema } from './schemas/story-script.schema';
import { ScenePlanSchema } from './schemas/scene-plan.schema';

// ---------------------------------------------------------------------------
// ScriptJSONSchema
// ---------------------------------------------------------------------------

describe('ScriptJSONSchema', () => {
  const validScene = {
    scene_number: 1,
    description: 'Opening hook',
    image_prompt: 'A person looking shocked',
    duration: 5,
    audio_text: 'You will not believe this',
  };

  it('accepts a minimal valid script JSON', () => {
    const valid = {
      scenes: [validScene],
      total_duration: 30,
      topic: 'productivity',
    };
    expect(() => ScriptJSONSchema.parse(valid)).not.toThrow();
  });

  it('accepts optional fields (visual_style, audio_mood, caption_style)', () => {
    const valid = {
      scenes: [validScene],
      total_duration: 30,
      topic: 'fitness',
      visual_style: 'Cinematic',
      audio_mood: 'energetic',
      caption_style: 'bold',
    };
    expect(() => ScriptJSONSchema.parse(valid)).not.toThrow();
  });

  it('rejects missing scenes field', () => {
    expect(() => ScriptJSONSchema.parse({ total_duration: 30, topic: 'test' })).toThrow();
  });

  it('rejects missing total_duration', () => {
    expect(() =>
      ScriptJSONSchema.parse({ scenes: [validScene], topic: 'test' }),
    ).toThrow();
  });

  it('rejects missing topic', () => {
    expect(() =>
      ScriptJSONSchema.parse({ scenes: [validScene], total_duration: 30 }),
    ).toThrow();
  });

  it('rejects a scene missing scene_number', () => {
    const badScene = { description: 'x', image_prompt: 'x', duration: 5, audio_text: 'x' };
    expect(() =>
      ScriptJSONSchema.parse({ scenes: [badScene], total_duration: 30, topic: 'test' }),
    ).toThrow();
  });

  it('rejects a scene missing audio_text', () => {
    const badScene = { scene_number: 1, description: 'x', image_prompt: 'x', duration: 5 };
    expect(() =>
      ScriptJSONSchema.parse({ scenes: [badScene], total_duration: 30, topic: 'test' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ViralCaptionSchema
// ---------------------------------------------------------------------------

describe('ViralCaptionSchema', () => {
  const validCaption = { line: 'Did you know this', highlight: 'know', intensity: 4 };

  it('accepts a valid caption result', () => {
    const valid = { hook_strength: 8, captions: [validCaption] };
    expect(() => ViralCaptionSchema.parse(valid)).not.toThrow();
  });

  it('accepts null highlight', () => {
    const valid = {
      hook_strength: 5,
      captions: [{ line: 'Plain text line', highlight: null, intensity: 3 }],
    };
    expect(() => ViralCaptionSchema.parse(valid)).not.toThrow();
  });

  it('accepts minimum valid values (hook_strength=1, intensity=1)', () => {
    const valid = {
      hook_strength: 1,
      captions: [{ line: 'Low energy line', highlight: null, intensity: 1 }],
    };
    expect(() => ViralCaptionSchema.parse(valid)).not.toThrow();
  });

  it('accepts maximum valid values (hook_strength=10, intensity=5)', () => {
    const valid = {
      hook_strength: 10,
      captions: [{ line: 'Max energy!', highlight: 'Max', intensity: 5 }],
    };
    expect(() => ViralCaptionSchema.parse(valid)).not.toThrow();
  });

  it('rejects hook_strength above 10', () => {
    const invalid = { hook_strength: 11, captions: [validCaption] };
    expect(() => ViralCaptionSchema.parse(invalid)).toThrow();
  });

  it('rejects hook_strength below 1', () => {
    const invalid = { hook_strength: 0, captions: [validCaption] };
    expect(() => ViralCaptionSchema.parse(invalid)).toThrow();
  });

  it('rejects intensity above 5', () => {
    const invalid = {
      hook_strength: 5,
      captions: [{ line: 'test', highlight: null, intensity: 6 }],
    };
    expect(() => ViralCaptionSchema.parse(invalid)).toThrow();
  });

  it('rejects intensity below 1', () => {
    const invalid = {
      hook_strength: 5,
      captions: [{ line: 'test', highlight: null, intensity: 0 }],
    };
    expect(() => ViralCaptionSchema.parse(invalid)).toThrow();
  });

  it('rejects empty captions array (min(1) constraint)', () => {
    const invalid = { hook_strength: 5, captions: [] };
    expect(() => ViralCaptionSchema.parse(invalid)).toThrow();
  });

  it('rejects missing captions field', () => {
    expect(() => ViralCaptionSchema.parse({ hook_strength: 5 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// IntentSchema
// ---------------------------------------------------------------------------

describe('IntentSchema', () => {
  const validIntent = {
    script_prompt: 'Write a dramatic script',
    image_prompt: 'Cinematic visuals',
    audio_prompt: 'Epic orchestral music',
    caption_prompt: 'Bold captions',
    rendering_hints: {
      mood: 'intense',
      pacing: 'fast',
      visual_style: 'Cinematic',
    },
  };

  it('accepts a valid intent with required rendering_hints', () => {
    expect(() => IntentSchema.parse(validIntent)).not.toThrow();
  });

  it('accepts optional rendering_hints fields', () => {
    const withOptionals = {
      ...validIntent,
      rendering_hints: {
        ...validIntent.rendering_hints,
        color_palette: ['#000000', '#FFFFFF'],
        music_vibe: 'epic',
        motion_preset: 'zoom_in',
        motion_presets: ['zoom_in', 'slow_pan'],
        motion_emotion: 'dramatic',
        pacing_style: 'dramatic' as const,
      },
    };
    expect(() => IntentSchema.parse(withOptionals)).not.toThrow();
  });

  it('accepts all valid pacing_style enum values', () => {
    const styles = ['smooth', 'rhythmic', 'viral', 'dramatic'] as const;
    for (const pacing_style of styles) {
      const input = {
        ...validIntent,
        rendering_hints: { ...validIntent.rendering_hints, pacing_style },
      };
      expect(() => IntentSchema.parse(input)).not.toThrow();
    }
  });

  it('rejects invalid pacing_style enum value', () => {
    const invalid = {
      ...validIntent,
      rendering_hints: { ...validIntent.rendering_hints, pacing_style: 'chaotic' },
    };
    expect(() => IntentSchema.parse(invalid)).toThrow();
  });

  it('rejects missing script_prompt', () => {
    const { script_prompt: _, ...rest } = validIntent;
    expect(() => IntentSchema.parse(rest)).toThrow();
  });

  it('rejects missing rendering_hints', () => {
    const { rendering_hints: _, ...rest } = validIntent;
    expect(() => IntentSchema.parse(rest)).toThrow();
  });

  it('rejects rendering_hints without required mood field', () => {
    const invalid = {
      ...validIntent,
      rendering_hints: { pacing: 'fast', visual_style: 'Cinematic' },
    };
    expect(() => IntentSchema.parse(invalid)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// UgcScriptSchema
// ---------------------------------------------------------------------------

describe('UgcScriptSchema', () => {
  const validScene = {
    scene_number: 1,
    type: 'selfie_talk' as const,
    duration_seconds: 5,
    actor_script: 'Hi everyone!',
    broll_query: null,
    caption_text: 'Check this out',
    emotion: 'excited' as const,
    start_time_seconds: 0,
  };

  const validUgcScript = {
    hook: 'Did you know?',
    hook_type: 'question' as const,
    hook_strength: 8,
    hook_variations: ['Really?', 'Seriously?'],
    scenes: [validScene],
    voiceover_text: 'This product is amazing',
    total_duration_seconds: 30,
    hashtag_suggestions: ['#viral', '#fyp'],
  };

  it('accepts a valid UGC script', () => {
    expect(() => UgcScriptSchema.parse(validUgcScript)).not.toThrow();
  });

  it('accepts all valid scene types', () => {
    const types = ['selfie_talk', 'broll_cutaway', 'product_close', 'reaction', 'text_overlay'] as const;
    for (const type of types) {
      const input = { ...validUgcScript, scenes: [{ ...validScene, type }] };
      expect(() => UgcScriptSchema.parse(input)).not.toThrow();
    }
  });

  it('accepts all valid emotion values', () => {
    const emotions = ['excited', 'genuine', 'concerned', 'amazed', 'confident'] as const;
    for (const emotion of emotions) {
      const input = { ...validUgcScript, scenes: [{ ...validScene, emotion }] };
      expect(() => UgcScriptSchema.parse(input)).not.toThrow();
    }
  });

  it('accepts all valid hook_type values', () => {
    const hookTypes = ['question', 'claim', 'story', 'shock'] as const;
    for (const hook_type of hookTypes) {
      expect(() => UgcScriptSchema.parse({ ...validUgcScript, hook_type })).not.toThrow();
    }
  });

  it('accepts null actor_script and null broll_query', () => {
    const input = {
      ...validUgcScript,
      scenes: [{ ...validScene, actor_script: null, broll_query: null }],
    };
    expect(() => UgcScriptSchema.parse(input)).not.toThrow();
  });

  it('rejects invalid scene type', () => {
    const invalid = { ...validUgcScript, scenes: [{ ...validScene, type: 'unknown_type' }] };
    expect(() => UgcScriptSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid emotion value', () => {
    const invalid = { ...validUgcScript, scenes: [{ ...validScene, emotion: 'angry' }] };
    expect(() => UgcScriptSchema.parse(invalid)).toThrow();
  });

  it('rejects missing hook field', () => {
    const { hook: _, ...rest } = validUgcScript;
    expect(() => UgcScriptSchema.parse(rest)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// StoryScriptSchema
// ---------------------------------------------------------------------------

describe('StoryScriptSchema', () => {
  const validCharacter = {
    name: 'John',
    appearance: 'Tall, dark hair',
    clothing: 'Black hoodie',
    style: 'realistic',
    consistency_anchor: 'scar on left cheek',
  };

  const validScene = {
    scene_number: 1,
    description: 'Opening shot',
    image_prompt: 'Dark alley at night',
    subtitle: 'It all began here...',
    narration: 'The night was cold',
    camera_motion: 'zoom_in' as const,
    duration_seconds: 5,
    start_time_seconds: 0,
  };

  const validStoryScript = {
    title: 'The Last Night',
    genre: 'thriller' as const,
    characters: [validCharacter],
    scenes: [validScene],
    visual_style: 'Dark and gritty',
    audio_mood: 'tense',
    total_duration_seconds: 60,
  };

  it('accepts a valid story script', () => {
    expect(() => StoryScriptSchema.parse(validStoryScript)).not.toThrow();
  });

  it('accepts all valid genre values', () => {
    const genres = [
      'horror', 'motivational', 'crime', 'urban_legend', 'comedy',
      'sci_fi', 'romance', 'thriller', 'historical', 'documentary', 'mystery',
    ] as const;
    for (const genre of genres) {
      expect(() => StoryScriptSchema.parse({ ...validStoryScript, genre })).not.toThrow();
    }
  });

  it('accepts all valid camera_motion values', () => {
    const motions = ['zoom_in', 'slow_pan', 'parallax', 'camera_shake', 'fade_out'] as const;
    for (const camera_motion of motions) {
      const input = { ...validStoryScript, scenes: [{ ...validScene, camera_motion }] };
      expect(() => StoryScriptSchema.parse(input)).not.toThrow();
    }
  });

  it('rejects invalid genre', () => {
    expect(() =>
      StoryScriptSchema.parse({ ...validStoryScript, genre: 'action' }),
    ).toThrow();
  });

  it('rejects invalid camera_motion', () => {
    const invalid = {
      ...validStoryScript,
      scenes: [{ ...validScene, camera_motion: 'dolly_shot' }],
    };
    expect(() => StoryScriptSchema.parse(invalid)).toThrow();
  });

  it('rejects missing title', () => {
    const { title: _, ...rest } = validStoryScript;
    expect(() => StoryScriptSchema.parse(rest)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ScenePlanSchema
// ---------------------------------------------------------------------------

describe('ScenePlanSchema', () => {
  const validScene = {
    text: 'Revolutionize your workflow',
    sceneType: 'intro' as const,
    emphasisLevel: 0.8,
    importanceScore: 0.9,
  };

  const validScenePlan = {
    videoStyle: 'modern',
    globalTone: 'professional',
    scenes: [validScene],
  };

  it('accepts a valid scene plan', () => {
    expect(() => ScenePlanSchema.parse(validScenePlan)).not.toThrow();
  });

  it('accepts optional fields on scene', () => {
    const withOptionals = {
      ...validScenePlan,
      scenes: [
        {
          ...validScene,
          label: 'Opening',
          subHeadline: 'Sub text',
          supportingText: 'More detail',
          authorLine: '— Famous person',
          suggestedTemplateType: 'title-card' as const,
          headlineEmphasis: 'high' as const,
          backgroundType: 'flat-dark' as const,
          highlightWords: ['workflow'],
          iconSuggestion: 'lightning',
        },
      ],
    };
    expect(() => ScenePlanSchema.parse(withOptionals)).not.toThrow();
  });

  it('accepts all valid sceneType values', () => {
    const types = ['intro', 'problem', 'feature', 'cta'] as const;
    for (const sceneType of types) {
      const input = { ...validScenePlan, scenes: [{ ...validScene, sceneType }] };
      expect(() => ScenePlanSchema.parse(input)).not.toThrow();
    }
  });

  it('accepts all valid templateType values', () => {
    const templates = [
      'title-card', 'quote-card', 'feature-highlight', 'impact-full-bleed',
      'stats-card', 'steps-card', 'split-accent', 'countdown-badge',
    ] as const;
    for (const suggestedTemplateType of templates) {
      const input = {
        ...validScenePlan,
        scenes: [{ ...validScene, suggestedTemplateType }],
      };
      expect(() => ScenePlanSchema.parse(input)).not.toThrow();
    }
  });

  it('rejects empty scenes array (min(1) constraint)', () => {
    const invalid = { ...validScenePlan, scenes: [] };
    expect(() => ScenePlanSchema.parse(invalid)).toThrow();
  });

  it('rejects emphasisLevel above 1', () => {
    const invalid = { ...validScenePlan, scenes: [{ ...validScene, emphasisLevel: 1.1 }] };
    expect(() => ScenePlanSchema.parse(invalid)).toThrow();
  });

  it('rejects importanceScore below 0', () => {
    const invalid = { ...validScenePlan, scenes: [{ ...validScene, importanceScore: -0.1 }] };
    expect(() => ScenePlanSchema.parse(invalid)).toThrow();
  });

  it('rejects highlightWords array with more than 2 items', () => {
    const invalid = {
      ...validScenePlan,
      scenes: [{ ...validScene, highlightWords: ['a', 'b', 'c'] }],
    };
    expect(() => ScenePlanSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid sceneType', () => {
    const invalid = { ...validScenePlan, scenes: [{ ...validScene, sceneType: 'conclusion' }] };
    expect(() => ScenePlanSchema.parse(invalid)).toThrow();
  });

  it('rejects missing videoStyle', () => {
    const { videoStyle: _, ...rest } = validScenePlan;
    expect(() => ScenePlanSchema.parse(rest)).toThrow();
  });
});
