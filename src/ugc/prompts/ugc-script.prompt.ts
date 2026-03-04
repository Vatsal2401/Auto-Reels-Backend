export function buildUgcScriptPrompt(params: {
  productName: string;
  productDescription: string;
  benefits: string[];
  targetAudience: string;
  callToAction: string;
  ugcStyle: string;
}): { systemPrompt: string; userPrompt: string } {
  const { productName, productDescription, benefits, targetAudience, callToAction, ugcStyle } =
    params;

  const styleGuides: Record<string, string> = {
    selfie_review: 'hook → problem_agitation → solution_reveal → result_proof → cta',
    unboxing: 'hook → first_impressions → product_features → reaction → cta',
    problem_solution: 'shock_stat → problem_broll → personal_intro → demo → cta',
    before_after: 'before_state → personal_intro → after_result → testimonial → cta',
    tiktok_story: 'story_hook → buildup → tension → reveal → cta',
  };

  const systemPrompt = `You are an expert UGC (User-Generated Content) video ad scriptwriter specializing in high-converting performance marketing scripts for TikTok and Instagram Reels.

Your job is to generate a complete UGC video script following the exact JSON schema below. The script must feel authentic, conversational, and native — not like a polished ad.

CRITICAL RULES:
1. The hook MUST stop the scroll in the first 2 seconds. Use pattern interrupts: unexpected claims, relatable pain, or curiosity gaps.
2. Each scene must be 3-8 seconds. Total video 20-40 seconds.
3. broll_cutaway scenes have null actor_script (actor is hidden during these).
4. All spoken text must sound natural, NOT scripted. Use contractions, pauses ("..."), emphasis.
5. Output ONLY valid JSON. No markdown, no explanation.

JSON SCHEMA:
{
  "hook": "string — the very first spoken sentence (scroll-stopper)",
  "hook_type": "question | claim | story | shock",
  "hook_strength": "number 1-10",
  "hook_variations": ["string", "string", "string"],
  "scenes": [
    {
      "scene_number": "number",
      "type": "selfie_talk | broll_cutaway | product_close | reaction | text_overlay",
      "duration_seconds": "number 3-8",
      "actor_script": "string or null",
      "broll_query": "string or null",
      "caption_text": "string — short on-screen text",
      "emotion": "excited | genuine | concerned | amazed | confident",
      "start_time_seconds": "number"
    }
  ],
  "voiceover_text": "string — full concatenated VO text in order",
  "total_duration_seconds": "number",
  "hashtag_suggestions": ["string"]
}`;

  const userPrompt = `Create a UGC video ad script with the following details:

Product: ${productName}
Description: ${productDescription}
Key Benefits: ${benefits.length > 0 ? benefits.join(', ') : 'as described above'}
Target Audience: ${targetAudience}
Call to Action: ${callToAction}
UGC Style: ${ugcStyle}
Scene Flow: ${styleGuides[ugcStyle] || styleGuides.selfie_review}

Generate a complete UgcScriptJSON. The hook must be punchy, authentic, and under 15 words. Include 4-6 scenes with at least one broll_cutaway. Ensure voiceover_text concatenates all actor_script fields in scene order.`;

  return { systemPrompt, userPrompt };
}
