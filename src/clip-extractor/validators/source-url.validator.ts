import { BadRequestException } from '@nestjs/common';

const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'www.tiktok.com',
  'tiktok.com',
  'vm.tiktok.com',
]);

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

/**
 * Validates a user-submitted source URL.
 * Prevents SSRF by allowlisting only YouTube/TikTok and blocking private IP ranges.
 * Returns the sanitized URL string.
 */
export function validateSourceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL format');
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException('Only HTTPS URLs are allowed');
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new BadRequestException('Only YouTube and TikTok URLs are supported');
  }

  if (PRIVATE_IP_PATTERNS.some((r) => r.test(url.hostname))) {
    throw new BadRequestException('Invalid URL');
  }

  return url.toString();
}
