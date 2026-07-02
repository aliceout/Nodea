import type { Context, MiddlewareHandler } from 'hono';

import { globalSingleton } from '../lib/global-singleton.ts';

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
  /**
   * Optional custom bucket key — e.g. the authenticated user id
   * (mount the limiter AFTER `requireUser` in that case), or the
   * pending-MFA session's user so a TOTP brute-force can't dodge
   * the limiter by rotating IPs (audit 2026-06). When it returns
   * `null` the limiter falls back to the trusted client IP.
   */
  keyFn?: (c: Context) => string | null;
  /**
   * When `true`, a request that ends in an error response (status
   * ≥ 400) does NOT consume the caller's budget — the increment made
   * for it is rolled back after the handler runs. Use it where the
   * budget should meter *successful* actions, so a rejected attempt
   * (bad input, already-taken target, a downstream 4xx) can't block a
   * legitimate retry. Off by default: a login limiter, say, wants
   * failures to count.
   */
  skipFailedRequests?: boolean;
}

// Stashed on globalThis so Vitest 4's per-test-file module
// re-evaluation can't fragment the storage — see [[global-singleton]].
// `lastSweep` is wrapped in an object so the sweep can mutate it
// through the shared reference.
const buckets = globalSingleton(
  '__nodea_rate_limit_buckets',
  () => new Map<string, Bucket>(),
);
const sweepState = globalSingleton(
  '__nodea_rate_limit_sweep',
  () => ({ lastSweep: Date.now() }),
);

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
  if (now - sweepState.lastSweep < 60_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  sweepState.lastSweep = now;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const prefix = opts.keyPrefix ?? 'rl';
  return async (c, next) => {
    const now = Date.now();
    sweep(now);
    const customKey = opts.keyFn?.(c) ?? null;
    const key = customKey
      ? `${prefix}:${customKey}`
      : getClientKey(c.req.raw.headers, prefix);
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

    // `skipFailedRequests`: an error response didn't perform the metered
    // action, so refund the increment we made above (only successes count).
    // The limiter's own 429 returns before `next()`, so it's never refunded.
    if (opts.skipFailedRequests && c.res.status >= 400) {
      const b = buckets.get(key);
      if (b) {
        b.count -= 1;
        if (b.count <= 0) buckets.delete(key);
      }
    }
  };
}

/** Test-only: reset all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
  sweepState.lastSweep = 0;
}
