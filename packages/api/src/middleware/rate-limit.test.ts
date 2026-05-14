import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';

import { __resetRateLimits, rateLimit } from './rate-limit.ts';

/** Build a tiny app that returns 200 once the limiter passes. */
function makeApp(): Hono {
  const app = new Hono();
  app.use(
    '*',
    rateLimit({ max: 2, windowMs: 60_000, keyPrefix: 'test' }),
  );
  app.get('/ping', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimit middleware — SEC-03 (trusted IP from last hop)', () => {
  afterEach(() => {
    __resetRateLimits();
  });

  it('counts requests by IP and returns 429 over the limit', async () => {
    const app = makeApp();
    const headers = { 'x-forwarded-for': '203.0.113.10' };

    expect((await app.request('/ping', { headers })).status).toBe(200);
    expect((await app.request('/ping', { headers })).status).toBe(200);
    expect((await app.request('/ping', { headers })).status).toBe(429);
  });

  it('uses the LAST hop of X-Forwarded-For — a spoofed first hop cannot bypass the limit', async () => {
    // The proxy chain reads "1.1.1.1, 2.2.2.2, 3.3.3.3" where the
    // attacker controls 1.1.1.1 (their own value) and 3.3.3.3 is
    // what the trusted nginx wrote. We must bucket on 3.3.3.3.
    //
    // Spoofing strategy : the attacker sends N requests, varying
    // ONLY the first hop of X-Forwarded-For each time, hoping the
    // limiter buckets each request into a fresh bucket and never
    // hits the limit. Pre-fix, this worked. Post-fix, all the
    // requests share the same last-hop bucket and the limiter
    // catches them.
    const app = makeApp();

    // Same trusted-last-hop IP, varying spoofed first hop.
    const r1 = await app.request('/ping', {
      headers: { 'x-forwarded-for': 'evil-1.1.1.1, 3.3.3.3' },
    });
    const r2 = await app.request('/ping', {
      headers: { 'x-forwarded-for': 'evil-2.2.2.2, 3.3.3.3' },
    });
    const r3 = await app.request('/ping', {
      headers: { 'x-forwarded-for': 'evil-9.9.9.9, 3.3.3.3' },
    });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });

  it('treats different real IPs as separate buckets', async () => {
    // Counter-test : when two distinct trusted-last-hop IPs make
    // requests independently, the limiter must NOT bucket them
    // together. Otherwise a noisy neighbour would rate-limit
    // honest users.
    const app = makeApp();

    expect(
      (
        await app.request('/ping', {
          headers: { 'x-forwarded-for': '4.4.4.4' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request('/ping', {
          headers: { 'x-forwarded-for': '4.4.4.4' },
        })
      ).status,
    ).toBe(200);
    // 4.4.4.4 is now at its limit, but 5.5.5.5 should be untouched.
    expect(
      (
        await app.request('/ping', {
          headers: { 'x-forwarded-for': '5.5.5.5' },
        })
      ).status,
    ).toBe(200);
  });

  it('falls back to x-real-ip when X-Forwarded-For is absent', async () => {
    const app = makeApp();
    const headers = { 'x-real-ip': '6.6.6.6' };

    expect((await app.request('/ping', { headers })).status).toBe(200);
    expect((await app.request('/ping', { headers })).status).toBe(200);
    expect((await app.request('/ping', { headers })).status).toBe(429);
  });

  it('falls back to a single "unknown" bucket when no IP header is present', async () => {
    const app = makeApp();

    expect((await app.request('/ping')).status).toBe(200);
    expect((await app.request('/ping')).status).toBe(200);
    expect((await app.request('/ping')).status).toBe(429);
  });
});
