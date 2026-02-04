export function getScriptGenerationPrompt(
  topic: string,
  duration: number,
  language: string,
  audioStyle: string = '',
  visualStyle: string = 'Cinematic', // Receives the user's chosen style from the UI
): string {
  const audioStyleSection = audioStyle
    ? `\nNARRATION STYLE: ${audioStyle}. Use this to guide sentence length and emphasis.`
    : '';

  // Calculate minimum word count to ensure duration is met
  // Average speaking rate is ~130-150 words per minute.
  // For a 45s video, we need ~100-110 words.
  const minWords = Math.floor(duration * 2.2);

  return `You are a professional social media scriptwriter specializing in high-retention Reels/Shorts.
Create a ${duration}-second video script about: "${topic}".
THEME: ${visualStyle}. Ensure all imagery and tone reflects this style.
LANGUAGE: ${language}.${audioStyleSection}

DURATION & WORD-COUNT RULES (MANDATORY):
1. TOTAL LENGTH: The script MUST be at least ${minWords} words total. 
2. SCENE WORDS: Each 5-second scene MUST have at least 15-20 words.
3. BE VERBOSE: Use descriptive, engaging language. If the text is too short, the video fails. 
4. PACING: 0-3s is a "Pattern Interrupt" hook. 

Output ONLY valid JSON:
{
  "topic": "${topic}",
  "audio_mood": "Detailed description of music mood (e.g., Manic, Chill, Epic)",
  "total_duration": ${duration},
  "scenes": [
    {
      "scene_number": 1,
      "description": "Visual setting",
      "image_prompt": "CRITICAL: Describe the scene following the ${visualStyle} style. Include lighting and composition.",
      "duration": 5,
      "audio_text": "Narration text in ${language} (MUST be 15+ words for this 5s slot)"
    }
  ]
}`;
}

export function getSimpleScriptPrompt(topic: string): string {
  return `Write a highly engaging 30-second video script about: "${topic}". 
    Format with 6 scenes. Each scene needs at least 15 words of narration to fill the time.`;
}

export function getOpenAIScriptSystemPrompt(duration: string | number, language: string): string {
  const numDuration = Number(duration) || 30;
  const minWords = Math.floor(numDuration * 2.2);

  return `You are a viral script writer.
Create a structured script for a ${numDuration}-second Reel.
LANGUAGE: ${language}.

STRICT WORD COUNT:
- Total words must be at least ${minWords}.
- Short scripts are BANNED. Be descriptive and verbose.
- Each scene needs 18-22 words for 5 seconds of footage.

Return ONLY valid JSON:
{
  "scenes": [
    {
      "scene_number": 1,
      "description": "Visual details",
      "image_prompt": "Cinematic AI image prompt",
      "duration": 5,
      "audio_text": "Narration in ${language} (MUST be 18+ words)"
    }
  ],
  "total_duration": ${numDuration},
  "topic": "Topic Name"
}`;
}

export function getOpenAISimpleScriptPrompt(topic: string): string {
  return `Write an engaging script about ${topic}. Ensure it is long enough to last 45 seconds (approx 100 words).`;
}
