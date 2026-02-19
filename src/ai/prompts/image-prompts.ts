export function getImageGenerationPrompt(prompt: string, style: string = ''): string {
  // Framing as a real camera capture pushes models into photography mode,
  // away from graphic-design / thumbnail / text-overlay aesthetics.
  const cameraPrefix = style && style !== 'auto'
    ? `A single full-frame ${style} photograph taken with a professional DSLR camera, captured in the real world —`
    : 'A single full-frame photograph taken with a professional DSLR camera, captured in the real world —';

  const qualityTags =
    'sharp focus, 8k resolution, cinematic lighting, dramatic shadows, photorealistic, award-winning photography';

  // Closing instruction — repeated at end for stronger signal
  const closingSuffix =
    'This is a pure camera photograph. There is no text, no words, no letters, no numbers, ' +
    'no captions, no titles, no watermarks, no typography, no labels, no overlays, ' +
    'no infographics, no thumbnails, no graphic design elements anywhere in the image. ' +
    'Only real-world physical subjects captured by a camera lens.';

  return `${cameraPrefix} ${prompt}. ${qualityTags}. ${closingSuffix}`;
}
