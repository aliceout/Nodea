import type { MiddlewareHandler } from 'hono';

/**
 * Trivial fixed-window rate limiter, in-process memory only.
 *
 * - Keyed on client IP from `x-forwarded-for` (first hop) or the remote
 *   address fallback. Adjust when a real reverse proxy setup is chosen.
 * - Single-instance only: each API replica keeps its own counters. When
 *   scaled out, move this to Redis or a shared store.
 * - Memory bounded by periodic sweep (every ~1 min) of expired buckets.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Number of allowed requests per window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Prefix for the key — useful if multiple limiters coexist. */
  keyPrefix?: string;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function getClientKey(headers: Headers, prefix: string): string {
  const fwd = headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  lastSweep = now;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const prefix = opts.keyPrefix ?? 'rl';
  return async (c, next) => {
    const now = Date.now();
    sweep(now);
    const key = getClientKey(c.req.raw.headers, prefix);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > opts.max) {
        const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        c.header('Retry-After', String(retryAfterSec));
        return c.json({ error: 'rate_limited' }, 429);
      }
    }
    await next();
  };
}

/** Test-only: reset all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
