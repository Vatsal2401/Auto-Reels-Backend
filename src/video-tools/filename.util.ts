export function getResizedFilename(originalName: string, width: number, height: number): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video';
  return `${base}_resized_${width}x${height}.mp4`;
}

export function getCompressedFilename(originalName: string, presetLabel: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video';
  const slug = String(presetLabel).toLowerCase().replace(/\s+/g, '_');
  return `${base}_compressed_${slug}.mp4`;
}

export function getInputExtension(originalName: string): string {
  const match = originalName.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '.mp4';
}
