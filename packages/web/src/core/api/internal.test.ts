/**
 * Unit tests for `request()` — specifically the response-schema
 * validation hook (ARCH-12). We verify three behaviours :
 *   - happy path : valid payload + valid schema → parsed value.
 *   - drift in dev : invalid payload + schema → throws (loud
 *     surface so the developer sees the contract drift).
 *   - no schema : raw cast (`unknown` payload returned as-is).
 *
 * We don't re-test the error path / fetch wiring — `client.test.ts`
 * already covers that surface. Keeping this file focused on the
 * schema hook keeps the two test suites independent.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

import { request } from './internal.ts';

vi.stubEnv('VITE_API_URL', 'http://test.local');

const SampleSchema = z.object({
  id: z.string(),
  count: z.number(),
});

function mockFetchOnce(payload: unknown, status = 200): void {
  const response = new Response(JSON.stringify(payload), { status });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('request() — response schema hook', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the payload as-is when no schema is passed', async () => {
    mockFetchOnce({ anything: 'goes', here: 42 });
    const out = await request<{ anything: string; here: number }>(
      'GET',
      '/anything',
    );
    expect(out).toEqual({ anything: 'goes', here: 42 });
  });

  it('parses through the schema when one is passed', async () => {
    mockFetchOnce({ id: 'abc', count: 7 });
    const out = await request('GET', '/sample', undefined, SampleSchema);
    expect(out).toEqual({ id: 'abc', count: 7 });
  });

  it('throws ZodError when the payload does not match the schema (test mode)', async () => {
    // Test runs under MODE='test', which `shouldValidateResponses()`
    // treats the same as DEV. A drifted payload should explode loudly.
    mockFetchOnce({ id: 'abc', count: 'not-a-number' });
    await expect(
      request('GET', '/sample', undefined, SampleSchema),
    ).rejects.toThrow(z.ZodError);
  });

  it('forwards the schema-narrowed type back to the caller', async () => {
    mockFetchOnce({ id: 'xyz', count: 1 });
    const out = await request('GET', '/sample', undefined, SampleSchema);
    // Type-level: `out` is `{ id: string; count: number }` (from the
    // schema's inferred output), so `out.count + 1` compiles. If the
    // generic forwarding broke we'd get a tsc error here.
    expect(out.count + 1).toBe(2);
    expect(out.id.length).toBe(3);
  });
});
