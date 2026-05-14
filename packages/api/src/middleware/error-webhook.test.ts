import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorWebhook } from './error-webhook.ts';

/**
 * `error-webhook` is fire-and-forget — the test waits one
 * microtask cycle after the route response so the queued
 * `fetch()` has a chance to run before assertions.
 */
async function flushPending(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

type FetchSpy = ReturnType<typeof vi.fn<typeof fetch>>;

describe('errorWebhook middleware', () => {
  let fetchSpy: FetchSpy;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('is a no-op when the URL is unset (the dev default)', async () => {
    const app = new Hono();
    app.use('*', errorWebhook(undefined));
    app.get('/boom', (c) => c.json({ error: 'oops' }, 500));

    const res = await app.request('/boom');
    await flushPending();

    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fire on 2xx / 3xx / 4xx responses', async () => {
    const app = new Hono();
    app.use('*', errorWebhook('https://hook.example/relay'));
    app.get('/ok', (c) => c.json({ status: 'ok' }));
    app.get('/notfound', (c) => c.json({ error: 'not_found' }, 404));
    app.get('/forbidden', (c) => c.json({ error: 'forbidden' }, 403));

    await app.request('/ok');
    await app.request('/notfound');
    await app.request('/forbidden');
    await flushPending();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fires a POST when the response is 500+', async () => {
    const app = new Hono();
    app.use('*', errorWebhook('https://hook.example/relay'));
    app.get('/boom', (c) => c.json({ error: 'oops' }, 500));

    const res = await app.request('/boom');
    await flushPending();

    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    expect(call[0]).toBe('https://hook.example/relay');
    expect(call[1]?.method).toBe('POST');
  });

  it('sends method + path + status + duration ONLY — no body, no headers, no query', async () => {
    const app = new Hono();
    app.use('*', errorWebhook('https://hook.example/relay'));
    app.post('/admin/dangerous-route', async (c) => {
      // Simulate a request body that must not leak into the webhook.
      await c.req.json().catch(() => null);
      return c.json({ error: 'kaboom' }, 503);
    });

    const res = await app.request('/admin/dangerous-route?token=secret-do-not-leak', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'nodea_session=must-not-leak',
        'x-guard': 'g_guard-must-not-leak',
      },
      body: JSON.stringify({ password: 'plaintext-must-not-leak' }),
    });
    await flushPending();

    expect(res.status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    const sent = JSON.parse(call[1]?.body as string) as Record<string, unknown>;

    // Body has only the safe summary fields.
    expect(Object.keys(sent).sort()).toEqual(['content', 'text']);

    const summary = sent.content as string;
    expect(sent.text).toBe(summary);

    // Contains the path + status + method.
    expect(summary).toContain('POST');
    expect(summary).toContain('/admin/dangerous-route');
    expect(summary).toContain('503');

    // Contains nothing from the request itself.
    expect(summary).not.toContain('secret-do-not-leak');
    expect(summary).not.toContain('plaintext-must-not-leak');
    expect(summary).not.toContain('must-not-leak');
    expect(summary).not.toContain('?token=');
    expect(summary).not.toContain('cookie');
  });

  it('does not propagate webhook failures to the caller', async () => {
    fetchSpy.mockImplementation(async () => {
      throw new Error('webhook down');
    });

    const app = new Hono();
    app.use('*', errorWebhook('https://hook.example/relay'));
    app.get('/boom', (c) => c.json({ error: 'oops' }, 500));

    // The route must still answer 500 even if the webhook is dead.
    const res = await app.request('/boom');
    await flushPending();

    expect(res.status).toBe(500);
    // The fetch was attempted but its rejection was swallowed.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
