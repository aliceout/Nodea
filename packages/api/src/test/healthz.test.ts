import { describe, it, expect } from 'vitest';

import { buildApp } from '../app.ts';

const app = buildApp();

describe('GET /healthz', () => {
  it('returns 200 + status:ok when Postgres answers the probe', async () => {
    // The test env always has Postgres reachable (vitest setup truncates
    // a real DB before each test). The probe should round-trip cleanly.
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
