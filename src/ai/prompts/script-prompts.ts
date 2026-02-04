export function getScriptGenerationPrompt(
    topic: string,
    duration: number,
    language: string,
    audioStyle: string = '',
    visualStyle: string = 'Cinematic',
): string {
    const audioStyleSection = audioStyle ? `\nNARRATION STYLE: ${audioStyle}.` : '';

    // Calculate target word counts
    // 150 wpm is a good standard.
    // 45s -> ~110 words MAX.
    const targetWords = Math.floor(duration * 2.1);
    const maxWords = Math.floor(duration * 2.5);

    return `You are a professional social media scriptwriter.
Create a ${duration}-second video script about: "${topic}".
THEME: ${visualStyle}.
LANGUAGE: ${language}.${audioStyleSection}

STRICT DURATION RULES (CRITICAL):
1. TOTAL LENGTH: The script MUST be between ${targetWords} and ${maxWords} words total.
2. LIMIT: DO NOT exceed ${maxWords} words. If you do, the audio will be too long.
3. SCENE BREAKDOWN: For a ${duration}s video, provide exactly ${Math.ceil(duration / 5)} scenes.
4. WORD DISTRIBUTION: Each 5-second scene should have roughly 15-20 words.

JSON FORMATTING RULES:
- Output ONLY valid JSON.
- NO comments inside JSON.
- NO trailing commas.
- NO markdown formatting.

Structure:
{
  "topic": "${topic}",
  "audio_mood": "Mood description",
  "total_duration": ${duration},
  "scenes": [
    {
      "scene_number": 1,
      "description": "Visual setting",
      "image_prompt": "Cinematic prompt in ${visualStyle} style.",
      "duration": 5,
      "audio_text": "Narration text in ${language} (approx 18 words)"
    }
  ]
}`;
}

export function getSimpleScriptPrompt(topic: string): string {
    return `Write a 30-second video script about: "${topic}". 
    Exactly 75 words total. 6 scenes. JSON format.`;
}

export function getOpenAIScriptSystemPrompt(duration: string | number, language: string): string {
    const numDuration = Number(duration) || 30;
    const targetWords = Math.floor(numDuration * 2.1);
    const maxWords = Math.floor(numDuration * 2.5);

    return `You are a viral script writer.
Create a ${numDuration}-second Reel script.
LANGUAGE: ${language}.

STRICT CONSTRAINTS:
- Word count MUST be between ${targetWords} and ${maxWords}.
- ABSOLUTELY NO more than ${maxWords} words.
- Format: JSON only. No comments. No markdown.

{
  "scenes": [
    {
      "scene_number": 1,
      "description": "...",
      "image_prompt": "...",
      "duration": 5,
      "audio_text": "Narration (approx 18 words)"
    }
  ],
  "total_duration": ${numDuration},
  "topic": "Topic Name"
}`;
}

export function getOpenAISimpleScriptPrompt(topic: string): string {
    return `Write a 45-second script about ${topic}. Strict limit: 100 words total. JSON only.`;
}
