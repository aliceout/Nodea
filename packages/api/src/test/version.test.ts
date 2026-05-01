import { describe, it, expect } from 'vitest';

import { buildApp } from '../app.ts';

const app = buildApp();

describe('GET /version', () => {
  it('returns the build identity with the three expected fields', async () => {
    const res = await app.request('/version');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      commit: expect.any(String),
      build_date: expect.any(String),
      branch: expect.any(String),
    });
  });

  it('does not expose any other fields (no `version`, no `api_version`)', async () => {
    const res = await app.request('/version');
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['branch', 'build_date', 'commit']);
  });
});
