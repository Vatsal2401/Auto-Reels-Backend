const TEXT_INVITING =
  /\b(quotes?|overlays?|captions?|titles?|headings?|labels?|signs?|written|posters?|typography|banners?)\b/gi;

function stripTextInvitingWords(prompt: string): string {
  return prompt.replace(TEXT_INVITING, '').replace(/\s{2,}/g, ' ').trim();
}

export function getImageGenerationPrompt(prompt: string, style: string = ''): string {
  // Framing as a real camera capture pushes models into photography mode,
  // away from graphic-design / thumbnail / text-overlay aesthetics.
  const cameraPrefix =
    style && style !== 'auto'
      ? `A single full-frame ${style} photograph taken with a professional DSLR camera, captured in the real world —`
      : 'A single full-frame photograph taken with a professional DSLR camera, captured in the real world —';

  const qualityTags =
    'sharp focus, 8k resolution, cinematic lighting, dramatic shadows, photorealistic, award-winning photography';

  // Closing instruction — CRITICAL framing for stronger signal against text baking
  const closingSuffix =
    'CRITICAL: This is a pure real-world camera photograph with absolutely zero text, words, letters, ' +
    'numbers, captions, subtitles, watermarks, motivational quotes, inspirational phrases, typography, ' +
    'labels, overlays, infographics, graphic design elements, banners, or any written language anywhere ' +
    'in the frame. No text of any kind. Only real physical subjects, people, objects, and environments ' +
    'captured by a camera lens.';

  return `${cameraPrefix} ${stripTextInvitingWords(prompt)}. ${qualityTags}. ${closingSuffix}`;
}
