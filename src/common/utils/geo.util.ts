import * as geoip from 'geoip-lite';
import { Request } from 'express';

/**
 * Extracts the real client IP from an Express request.
 * Handles proxies/load balancers by checking X-Forwarded-For first.
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; first entry is the client IP
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

/**
 * Returns the ISO 3166-1 alpha-2 country code (e.g. 'IN', 'US') for a given IP.
 * Returns null if the IP is private, unresolvable, or loopback.
 */
export function getCountryFromIp(ip: string): string | null {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) {
    return null; // Local dev / loopback — cannot detect
  }

  // Strip IPv6-mapped IPv4 prefix (e.g. "::ffff:1.2.3.4" → "1.2.3.4")
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const geo = geoip.lookup(cleanIp);
  return geo?.country || null;
}
