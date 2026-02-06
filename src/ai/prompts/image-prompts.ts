export function getImageGenerationPrompt(prompt: string, style: string = ''): string {
  // 1. DYNAMIC QUALITY BOOSTERS
  const enhancers = '8k resolution, cinematic lighting, dramatic shadows, sharp focus, masterpiece';

  // 2. ANTI-COLLAGE/ANTI-GRID LOGIC (Strictly for single high-quality outputs)
  const structuralConstraints =
    'SINGLE PHOTOGRAPH. NO grids. NO split screens. NO collages. NO text. NO storyboards. NO 2x2. ONE UNIFIED COMPOSITION ONLY.';

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
