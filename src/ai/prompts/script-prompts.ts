function getHindiScriptInstruction(language: string): string {
  if (!/hindi|hi|हिंदी/i.test(language)) return '';
  return `
SCRIPT WRITING (for Hindi only):
- When language is Hindi, write the ENTIRE script in ROMANIZED form only: use Latin/English letters to write Hindi words (e.g. "Dekho yeh bandar, pyaar ka rang chadha hai!").
- Do NOT use Devanagari script. No Hindi characters (no द, न, य, etc.). Every word must be in A-Z, a-z only.
- Example correct: "Aaj toh Valentine's Day hai, kya naachega yeh?" | Example wrong: "आज तो वैलेंटाइन डे है"`;
}

export function getScriptGenerationPrompt(
  topic: string,
  duration: number,
  language: string,
  audioStyle: string = '',
  visualStyle: string = 'Cinematic',
): string {
  const audioStyleSection = audioStyle ? `\nNARRATION STYLE: ${audioStyle}.` : '';
  const hindiInstruction = getHindiScriptInstruction(language);

  // Calculate strict word counts
  // For 45s, natural pacing is ~95-100 words.
  const targetWords = Math.floor(duration * 1.8);
  const absoluteMaxWords = Math.floor(duration * 2.1);

  return `You are a professional social media scriptwriter.
Create a ${duration}-second video script about: "${topic}".
THEME: ${visualStyle}.
LANGUAGE: ${language}.${audioStyleSection}${hindiInstruction}

STRICT DURATION CONTROL (LIFE-OR-DEATH):
1. **TOTAL WORD LIMIT**: The ENTIRE script (sum of all scenes) MUST be between ${targetWords} and ${absoluteMaxWords} words.
2. **ABSOLUTE MAXIMUM**: DO NOT, under any circumstances, exceed ${absoluteMaxWords} words. If you write 150+ words, the video will be broken and 2 minutes long. 
3. **SCENE COUNT**: Provide exactly ${Math.ceil(duration / 5)} scenes.
4. **WORDS PER SCENE**: Each 5-second scene should have exactly 10-12 words. Simple, punchy sentences only.
5. **NO HALLUCINATION**: Count your words. If you see more than 2 sentences in a scene, it's too long. Shorten it.

JSON FORMATTING:
- Output ONLY valid JSON.
- NO comments. NO markdown.

IMAGE RULES (for each scene's image_prompt):
- Describe ONE single full-frame visual per scene. No grids, no collages, no split screens.
- Do NOT describe any text, captions, words, or overlays on the image. Image must be text-free.

Structure:
{
  "topic": "${topic}",
  "audio_mood": "...",
  "total_duration": ${duration},
  "scenes": [
    {
      "scene_number": 1,
      "description": "...",
      "image_prompt": "Single visual only, no text on image",
      "duration": 5,
      "audio_text": "Exactly 10-12 words in ${language}${/hindi|hi/i.test(language) ? ', Romanized only (Latin letters, no Devanagari)' : ''}."
    }
  ]
}`;
}

export function getSimpleScriptPrompt(topic: string): string {
  return `Write a 30-second script about ${topic}. MAX 65 words total. JSON only.`;
}

export function getOpenAIScriptSystemPrompt(duration: string | number, language: string): string {
  const numDuration = Number(duration) || 30;
  const maxWords = Math.floor(numDuration * 2.1);
  const hindiInstruction = getHindiScriptInstruction(language);

  return `You are a viral script writer.
Create a ${numDuration}-second Reel script.
LANGUAGE: ${language}.${hindiInstruction}

STRICT CONSTRAINTS:
- TOTAL WORDS MUST NOT EXCEED ${maxWords}.
- Each 5s scene = 10-12 words.
- If you write too much, the audio will fail.

IMAGE RULES: Each image_prompt = one single full-frame visual. No grids, no text/captions on the image.
{
  "scenes": [
    {
      "scene_number": 1,
      "description": "...",
      "image_prompt": "Single visual, text-free",
      "duration": 5,
      "audio_text": "10-12 words narration"
    }
  ],
  "total_duration": ${numDuration},
  "topic": "Topic Name"
}`;
}

export function getOpenAISimpleScriptPrompt(topic: string): string {
  return `Write a 45-second script about ${topic}. ABSOLUTE LIMIT: 90 words. JSON only.`;
}
