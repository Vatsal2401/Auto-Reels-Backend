function getHindiScriptInstruction(language: string): string {
  if (!/hindi|hi|हिंदी/i.test(language)) return '';
  return `
SCRIPT WRITING (for Hindi only):
- When language is Hindi, write the ENTIRE script in HINDI (Devanagari script) ONLY.
- Use ONLY Devanagari characters (e.g. आ, ऐ, क, ख, न, म, य, र, ल, व, ह, etc.). NO Romanized/Latin letters. NO English words.
- Do NOT add transliteration in parentheses (e.g. wrong: "ऊँची इमारत (Unchi imarat)"). Write ONLY the Hindi line: "ऊँची इमारत".
- Every word must be in proper Hindi (Devanagari). Example correct: "देखो यह बंदर, प्यार का रंग चढ़ा है!" | Example wrong: "Dekho yeh bandar" or mixing English. NO Romanized form. NO Latin/English letters.
- One language only: output 100% in Hindi so captions and TTS display and speak proper Hindi. No mixed scripts.`;
}

/** Instruction for any language: single language only, no transliteration. */
function getSingleLanguageInstruction(language: string): string {
  if (/hindi|hi|हिंदी/i.test(language)) return ''; // covered by getHindiScriptInstruction
  return `
- Output script in the chosen language ONLY. Do NOT add transliteration in parentheses. Do NOT mix two scripts (e.g. native script + Roman/English in brackets). One language only.`;
}

export function getScriptGenerationPrompt(
  topic: string,
  duration: number,
  language: string,
  audioStyle: string = '',
  visualStyle: string = 'Cinematic',
): string {
  const targetWords = Math.floor(duration * 1.8);
  const absoluteMaxWords = Math.floor(duration * 2.1);
  const sceneCount = Math.ceil(duration / 5);
  const hindiInstruction = getHindiScriptInstruction(language);
  const singleLangInstruction = getSingleLanguageInstruction(language);
  const hindiNote = /hindi|hi|हिंदी/i.test(language) ? ', in Devanagari script only' : '';
  const audioMoodLine = audioStyle ? `\nNARRATION STYLE: ${audioStyle}.` : '';

  // Middle scenes range for narrative arc description
  const coreEnd = sceneCount - 2 > 1 ? `Scenes 2–${sceneCount - 2}` : 'Scene 2';
  const peakScene = sceneCount - 1;
  const ctaScene = sceneCount;

  return `You are a world-class viral short-form content scriptwriter for faceless reels.
You craft scripts that hook viewers in the first 2 seconds, build tension, and leave them thinking.

TOPIC: "${topic}"
DURATION: ${duration} seconds | SCENES: ${sceneCount} | WORDS: ${targetWords}–${absoluteMaxWords} total
VISUAL STYLE: ${visualStyle}
LANGUAGE: ${language}${audioMoodLine}${hindiInstruction}${singleLangInstruction}

━━━ NARRATIVE STRUCTURE ━━━
Follow this arc exactly — one clear idea per scene, each exactly 10-12 spoken words:

• Scene 1 — HOOK: Stop the scroll. Open with a shocking fact, bold claim, or curiosity gap.
  Great hooks: "This ancient trick rewired how the world's top athletes train."
               "Scientists discovered the real reason you can't focus after lunch."
               "Most people do this every day — and it's silently draining their energy."

• ${coreEnd} — CORE: One punchy insight or fact per scene. Each scene escalates intrigue.
  Build tension → make the viewer lean in. Don't resolve too early.

• Scene ${peakScene} — PEAK: The most impactful, surprising, or emotional reveal.
  This is the payoff scene — the "a-ha" moment.

• Scene ${ctaScene} — CTA: End with a thought-provoking question, bold takeaway, or challenge.
  Great CTAs: "Now ask yourself — are you living by design or by default?"
              "Try this for 7 days. Your brain will thank you."

━━━ WRITING RULES ━━━
✓ Spoken, conversational tone — write exactly how confident people talk on camera
✓ Active voice, present tense preferred, short punchy sentences
✓ Use power words: "secret", "hidden", "actually", "real reason", "nobody tells you", "shocking"
✓ Every sentence must stand alone — no run-ons, no "and then..." chains
✗ No filler openers: "So", "Well", "Hi guys", "Basically", "In this video", "Today we'll"
✗ No meta-references: "watch till the end", "don't forget to like", "in this reel"
✗ No padding — every word must earn its place

━━━ IMAGE PROMPT RULES ━━━
Each image_prompt = ONE single cinematic frame. Must specify ALL of these:
  [SUBJECT] + [COMPOSITION] + [LIGHTING] + [MOOD/ATMOSPHERE] + [${visualStyle} aesthetic]

Good: "Extreme close-up of weathered hands gripping a compass, golden hour backlight, ${visualStyle} color grade, shallow depth of field, warm amber tones"
Bad:  "Person thinking about success with motivational text overlay"

Vary composition across scenes (e.g. close-up → wide establishing → medium portrait → overhead):
- Use: close-up, extreme close-up, wide shot, medium shot, low-angle, overhead, silhouette
- Mood: dramatic shadows, soft diffused light, neon glow, golden hour, blue hour, candlelight

NEVER include in image_prompt:
✗ Text, captions, watermarks, signs with words, logos
✗ Infographics, charts, numbered lists, bullet points
✗ Split screens, grids, collages, multiple panels side-by-side
✗ Abstract floating symbols (e.g. "success symbols", "technology icons")
✗ The topic name depicted literally as text or concept labels

━━━ AUDIO MOOD — choose the best fit ━━━
Dramatic Orchestral | Lo-fi Chill | Energetic Electronic | Inspirational Piano
Dark Cinematic | Upbeat Pop | Ambient Minimal | Epic Motivational | Suspenseful Strings

━━━ CAPTION STYLE — choose one ━━━
Bold (large impactful text) | Minimal (clean lowercase) | Neon (glowing accent color) | Classic (subtitle style)

━━━ STRICT WORD COUNT ━━━
• TOTAL across ALL scenes: ${targetWords}–${absoluteMaxWords} words — DO NOT EXCEED
• Per scene: exactly 10-12 words (one punchy sentence)
• ${sceneCount} scenes × ~10 words = ~${sceneCount * 10} words ← aim here
• Count before submitting. If a scene has 2 sentences, it's too long — cut it.

OUTPUT — valid JSON only, no markdown fences, no comments:
{
  "topic": "${topic}",
  "audio_mood": "<chosen mood from list above>",
  "caption_style": "<Bold | Minimal | Neon | Classic>",
  "total_duration": ${duration},
  "scenes": [
    {
      "scene_number": 1,
      "description": "Scene purpose in one line (e.g. 'Hook — shocking stat about sleep deprivation')",
      "image_prompt": "Detailed single-frame cinematic visual. ${visualStyle} aesthetic. No text. Specific subject, composition, lighting, mood.",
      "duration": 5,
      "audio_text": "Exactly 10-12 spoken words in ${language}${hindiNote}."
    }
  ]
}`;
}

export function getSimpleScriptPrompt(topic: string): string {
  return `You are a viral reel scriptwriter. Write a 30-second faceless reel script about: "${topic}".

STRUCTURE: Hook (scene 1) → 4 core insights → CTA (last scene). 6 scenes total.
WORDS: MAX 65 total. Each scene = ~10 words. Punchy, spoken, active voice.
IMAGE PROMPTS: Cinematic single frames only — subject + composition + lighting. No text, no infographics.
AUDIO MOOD: pick from — Dramatic Orchestral, Lo-fi Chill, Energetic Electronic, Inspirational Piano, Dark Cinematic, Epic Motivational

OUTPUT — JSON only:
{
  "topic": "${topic}",
  "audio_mood": "<mood>",
  "caption_style": "<Bold | Minimal | Neon | Classic>",
  "total_duration": 30,
  "scenes": [
    {
      "scene_number": 1,
      "description": "Hook — <one line>",
      "image_prompt": "Cinematic single frame, no text",
      "duration": 5,
      "audio_text": "~10 spoken words"
    }
  ]
}`;
}

export function getOpenAIScriptSystemPrompt(
  duration: string | number,
  language: string,
  visualStyle: string = 'Cinematic',
  audioStyle: string = '',
): string {
  const numDuration = Number(duration) || 30;
  const maxWords = Math.floor(numDuration * 2.1);
  const minWords = Math.floor(numDuration * 1.8);
  const sceneCount = Math.ceil(numDuration / 5);
  const hindiInstruction = getHindiScriptInstruction(language);
  const singleLangInstruction = getSingleLanguageInstruction(language);
  const hindiNote = /hindi|hi|हिंदी/i.test(language) ? ', Devanagari script only' : '';
  const audioMoodLine = audioStyle ? `\nNARRATION STYLE: ${audioStyle}.` : '';

  const peakScene = sceneCount - 1;
  const ctaScene = sceneCount;

  return `You are a viral short-form content scriptwriter for faceless reels.
Write scripts that hook viewers in 2 seconds, build tension, and drive shares.

LANGUAGE: ${language}. One language only — no transliteration, no mixed scripts.
VISUAL STYLE: ${visualStyle}${audioMoodLine}${hindiInstruction}${singleLangInstruction}

DURATION: ${numDuration}s | SCENES: ${sceneCount} | WORDS: ${minWords}–${maxWords} (HARD LIMIT)

NARRATIVE ARC (follow strictly):
• Scene 1: HOOK — shocking fact, bold claim, or curiosity gap. Stop the scroll.
• Scenes 2–${peakScene - 1}: CORE — one punchy insight per scene, escalate intrigue
• Scene ${peakScene}: PEAK — most impactful or surprising reveal, the "a-ha" moment
• Scene ${ctaScene}: CTA — thought-provoking question or bold challenge

WRITING RULES:
✓ 10-12 words per scene — one punchy spoken sentence
✓ Conversational tone, active voice, present tense
✓ Power words: "secret", "hidden", "real reason", "nobody tells you", "shocking"
✗ No filler: "So", "Well", "Hi guys", "Today", "In this video", "Basically"
✗ No meta-references: "watch till end", "like and subscribe", "in this reel"

IMAGE PROMPT RULES (per scene):
- ONE cinematic frame: [subject] + [composition] + [lighting] + [mood] + [${visualStyle} style]
- Vary compositions: close-up, wide, medium, low-angle, overhead, silhouette
- NEVER: text, captions, infographics, split screens, abstract symbols, numbered lists

AUDIO MOODS (pick best fit):
Dramatic Orchestral | Lo-fi Chill | Energetic Electronic | Inspirational Piano
Dark Cinematic | Upbeat Pop | Ambient Minimal | Epic Motivational | Suspenseful Strings

CAPTION STYLES: Bold | Minimal | Neon | Classic

OUTPUT — JSON only:
{
  "topic": "topic name",
  "audio_mood": "<chosen mood>",
  "caption_style": "<Bold | Minimal | Neon | Classic>",
  "total_duration": ${numDuration},
  "scenes": [
    {
      "scene_number": 1,
      "description": "Hook — <one-line scene purpose>",
      "image_prompt": "Single cinematic frame. ${visualStyle} style. No text. Subject + composition + lighting + mood.",
      "duration": 5,
      "audio_text": "10-12 spoken words in ${language}${hindiNote}."
    }
  ]
}`;
}

export function getOpenAISimpleScriptPrompt(topic: string): string {
  return `You are a viral reel scriptwriter. Create a 45-second faceless reel about: "${topic}".

STRUCTURE: Hook → core insights → CTA. 9 scenes × ~10 words each.
ABSOLUTE WORD LIMIT: 90 words total.
IMAGE PROMPTS: Cinematic single frames — subject, composition, lighting. No text. No infographics.
OUTPUT: JSON only.`;
}
