export function getImageGenerationPrompt(prompt: string, style: string = ''): string {
  // 1. DYNAMIC QUALITY BOOSTERS
  const enhancers = '8k resolution, cinematic lighting, dramatic shadows, sharp focus, masterpiece';

  // 2. ANTI-COLLAGE/ANTI-GRID/NO-TEXT (Strictly for single high-quality outputs)
  const structuralConstraints =
    'SINGLE PHOTOGRAPH. ONE full-frame image only. NO grids. NO split screens. NO collages. NO text on image. NO words, letters, captions, or titles in the image. NO storyboards. NO 2x2 or multi-panel. ONE UNIFIED COMPOSITION ONLY. Text-free visual.';

  // 3. ARTISTIC REFINEMENT
  let finalPrompt = prompt;
  if (style && style !== 'auto') {
    // We anchor the style at the BEGINNING so the AI doesn't deviate
    finalPrompt = `An image in ${style} aesthetic. ${prompt}.`;
  }

  // 4. FINAL ASSEMBLE
  // We place constraints first so the AI knows the rules before the content
  return `${structuralConstraints} ${finalPrompt}. ${enhancers}.`;
}
