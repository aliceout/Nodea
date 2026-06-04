import type { MiddlewareHandler } from 'hono';

/**
 * Trivial fixed-window rate limiter, in-process memory only.
 *
 * - Keyed on client IP from the **last** hop of `x-forwarded-for`
 *   (SEC-03), with `x-real-ip` as a fallback. Reading the **first**
 *   hop — as the previous version did — let any caller spoof their
 *   own IP by sending `X-Forwarded-For: 1.2.3.4` in the request,
 *   which made the limiter trivially bypassable. The last hop is
 *   the one the trusted upstream nginx writes ; everything before
 *   it is attacker-controlled.
 * - Single-instance only: each API replica keeps its own counters. When
 *   scaled out, move this to Redis or a shared store.
 * - Memory bounded by periodic sweep (every ~1 min) of expired buckets.
 *
 * Operator pre-requisite (REC-S2) : the nginx upstream must use
 * `proxy_set_header X-Forwarded-For $remote_addr;` (NOT the default
 * `$proxy_add_x_forwarded_for` which preserves whatever the client
 * sent). Otherwise the "last hop" we read is still the attacker's
 * spoofed value.
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

// DEBUG : unique id per module instance. Logged from
// `__resetRateLimits` and the rate-limit handler so we can correlate
// "reset Map A but route incremented Map B".
const __DEBUG_MOD_ID = Math.random().toString(36).slice(2, 10);
console.warn(`[rate-limit DEBUG] module init mod=${__DEBUG_MOD_ID}`);

/** Extract the trusted client IP from a request's headers.
 *
 *  `X-Forwarded-For` is a comma-separated chain : each hop appends
 *  its view of the upstream. The trusted upstream (Nginx in front
 *  of the api) writes the real remote IP at the **end** of the
 *  chain. Reading the first entry would let a caller spoof their
 *  IP by sending `X-Forwarded-For: 1.2.3.4` and bypass the
 *  rate-limit (SEC-03).
 *
 *  Falls back to `x-real-ip` (some reverse proxies set it instead),
 *  then to a literal `'unknown'` so a missing-header request still
 *  gets a stable bucket key (rather than every such request
 *  landing in the same `''` bucket).
 */
function getClientKey(headers: Headers, prefix: string): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last) return `${prefix}:${last}`;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  return `${prefix}:${realIp || 'unknown'}`;
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
        console.warn(`[rate-limit DEBUG] 429 mod=${__DEBUG_MOD_ID} key=${key} count=${bucket.count}`);
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
  console.warn(`[rate-limit DEBUG] reset mod=${__DEBUG_MOD_ID} sizeBefore=${buckets.size}`);
  buckets.clear();
  lastSweep = 0;
}
