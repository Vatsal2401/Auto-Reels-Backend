function getGenreRules(genre: string): string {
  const rules: Record<string, string> = {
    horror: 'Slow dread building to a peak; use parallax+zoom_in for tension; subtitles ominous ALL CAPS.',
    motivational: 'Escalating energy; slow_pan for establishing shots, zoom_in for climax; affirming uplifting subtitles.',
    crime: 'Investigative pacing, noir tone; parallax for mystery; clipped factual subtitles.',
    urban_legend: 'Slow eerie build with reveal; mix slow_pan and camera_shake; dread subtitles.',
    comedy: 'Punchy quick pacing; zoom_in on punchlines; playful witty subtitles.',
    sci_fi: 'Wonder and tension alternating; slow_pan for alien/tech environments; speculative tone subtitles.',
    romance: 'Intimate gentle pacing; fade_out for longing moments; lyrical emotional subtitles.',
    thriller: 'Fast pacing with sudden pauses; camera_shake for danger beats; fragmented dread subtitles.',
    historical: 'Deliberate documentary-like pacing; slow_pan for landscapes; authoritative yet vivid subtitles.',
    documentary: 'Educational but engaging rhythm; neutral yet compelling; factual concise subtitles.',
    mystery: 'Tease with withheld information; parallax for the unknown; questions-and-clues subtitles.',
  };
  return rules[genre] ?? 'Craft an engaging narrative with strong emotional beats and vivid imagery.';
}

export function buildStoryScriptPrompt(params: {
  genre: string;
  sceneCount: number;
  userPrompt: string;
}): { systemPrompt: string; userPrompt: string } {
  const { genre, sceneCount, userPrompt: inputPrompt } = params;

  const genreRules = getGenreRules(genre);

  const systemPrompt = `You are a cinematic storytelling AI for short-form vertical video (9:16 reels).
Generate STRICT JSON matching the StoryScriptJSON schema below.

GENRE DIRECTION (${genre}): ${genreRules}

CRITICAL RULES:
1. Characters: define 1-2 main characters with detailed visual descriptions. Build a "consistency_anchor" string containing full appearance + clothing — inject it VERBATIM into every scene's image_prompt for visual consistency.
2. Image prompts: MUST start with the consistency_anchor of the character(s) appearing in the scene. Add scene-specific details after. Include the visual_style at the end.
3. Subtitles: hook-style, max 6 words total per scene, ALL CAPS, punchy (e.g. "THE SCARIEST\\nTHING HAPPENED").
4. Camera motion per emotional beat:
   - zoom_in: reveals, tension builds
   - slow_pan: atmosphere, establishing
   - parallax: mystery, suspense
   - camera_shake: shock, fear, action
   - fade_out: endings, resolution
5. Each scene: 6-12 seconds. Narration must be speakable in that duration (~2.5 words/second).
6. Output ONLY valid JSON. No markdown, no explanation.

JSON SCHEMA:
{
  "title": "string",
  "genre": "string",
  "characters": [
    {
      "name": "string",
      "appearance": "string — physical description",
      "clothing": "string — outfit description",
      "style": "string — art style e.g. cinematic animated",
      "consistency_anchor": "string — FULL injected description for image prompts"
    }
  ],
  "scenes": [
    {
      "scene_number": "number",
      "description": "string — what happens",
      "image_prompt": "string — starts with consistency_anchor + scene detail + visual style",
      "subtitle": "string — hook text, ALL CAPS, max 6 words, use \\n for line breaks",
      "narration": "string — spoken VO text for this scene",
      "camera_motion": "zoom_in | slow_pan | parallax | camera_shake | fade_out",
      "duration_seconds": "number 6-12",
      "start_time_seconds": "number"
    }
  ],
  "visual_style": "string — e.g. dark cinematic illustration, neon noir, gritty realism",
  "audio_mood": "string — e.g. tense minimal ambient, uplifting orchestral",
  "total_duration_seconds": "number"
}`;

  const userPrompt = `Genre: ${genre}. Scene count: ${sceneCount}. Story prompt: "${inputPrompt}".

Create a complete StoryScriptJSON for a ${sceneCount}-scene short-form video reel. Make it emotionally engaging for the ${genre} genre. Return valid JSON only.`;

  return { systemPrompt, userPrompt };
}
