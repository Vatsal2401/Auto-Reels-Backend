export const MAX_VIDEO_SIZE_MB = 100;
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

export const FILE_TOO_LARGE_MESSAGE = 'File exceeds 100MB limit. Please upload a smaller video.';

export function validateSize(bytes: number): { valid: boolean; error?: string } {
  if (bytes > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, error: FILE_TOO_LARGE_MESSAGE };
  }
  return { valid: true };
}
