export function getImageGenerationPrompt(prompt: string, style: string = ''): string {
  const qualityTags = 'sharp focus, 8k resolution, cinematic lighting, dramatic shadows, masterpiece, photorealistic';

  // Natural-language prohibition works better than caps-lock negatives
  const noTextPrefix =
    'Pure photograph with absolutely no text, words, letters, numbers, captions, titles, ' +
    'watermarks, or typography anywhere in the image. Single full-frame composition only — ' +
    'no grids, no collages, no split screens, no panels.';

  // Repeat prohibition at end — models attend to both ends of the prompt
  const noTextSuffix =
    'IMPORTANT: The image must contain zero text, zero words, zero letters, zero numbers. ' +
    'No title overlay. No caption. No graphic text element of any kind. Pure visual only.';

  let subjectPrompt = prompt;
  if (style && style !== 'auto') {
    subjectPrompt = `${style} style photography — ${prompt}`;
  }

  return `${noTextPrefix} ${subjectPrompt}. ${qualityTags}. ${noTextSuffix}`;
}
