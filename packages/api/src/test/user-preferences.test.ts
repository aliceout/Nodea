import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.ts';
import { TEST_PASSWORD, extractCookie, seedUser } from './helpers.ts';

const app = buildApp();

function jsonBody(method: 'POST' | 'PUT', body: unknown, cookie?: string): RequestInit {
  return {
    method,
    headers: cookie
      ? { 'content-type': 'application/json', cookie }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function cookieFor(email: string): Promise<string> {
  await seedUser(email);
  const res = await app.request(
    '/auth/login',
    jsonBody('POST', { email, password: TEST_PASSWORD }),
  );
  return extractCookie(res)!;
}

describe('GET /user-preferences', () => {
  it('returns nulls when the user has no row yet', async () => {
    const cookie = await cookieFor('pref1@example.com');
    const res = await app.request('/user-preferences', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cipher_iv: string | null;
      payload: string | null;
    };
    expect(body.cipher_iv).toBeNull();
    expect(body.payload).toBeNull();
  });

  it('returns 401 without a cookie', async () => {
    const res = await app.request('/user-preferences');
    expect(res.status).toBe(401);
  });
});

describe('PUT /user-preferences', () => {
  it('upserts the encrypted blob and GET reads it back', async () => {
    const cookie = await cookieFor('pref2@example.com');

    const put = await app.request(
      '/user-preferences',
      jsonBody('PUT', { cipher_iv: 'iv-a', payload: 'blob-a' }, cookie),
    );
    expect(put.status).toBe(200);

    const get1 = await app.request('/user-preferences', { headers: { cookie } });
    const body1 = (await get1.json()) as { cipher_iv: string; payload: string };
    expect(body1.cipher_iv).toBe('iv-a');
    expect(body1.payload).toBe('blob-a');

    // Second PUT overwrites the same row (1:1 on user_id).
    const put2 = await app.request(
      '/user-preferences',
      jsonBody('PUT', { cipher_iv: 'iv-b', payload: 'blob-b' }, cookie),
    );
    expect(put2.status).toBe(200);

    const get2 = await app.request('/user-preferences', { headers: { cookie } });
    const body2 = (await get2.json()) as { cipher_iv: string; payload: string };
    expect(body2.cipher_iv).toBe('iv-b');
    expect(body2.payload).toBe('blob-b');
  });

  it('rejects an invalid body (400)', async () => {
    const cookie = await cookieFor('pref3@example.com');
    const res = await app.request(
      '/user-preferences',
      jsonBody('PUT', { cipher_iv: '', payload: '' }, cookie),
    );
    expect(res.status).toBe(400);
  });

  it('isolates rows per user', async () => {
    const cookieA = await cookieFor('prefA@example.com');
    const cookieB = await cookieFor('prefB@example.com');

    await app.request(
      '/user-preferences',
      jsonBody('PUT', { cipher_iv: 'A-iv', payload: 'A-blob' }, cookieA),
    );
    await app.request(
      '/user-preferences',
      jsonBody('PUT', { cipher_iv: 'B-iv', payload: 'B-blob' }, cookieB),
    );

    const a = await app.request('/user-preferences', { headers: { cookie: cookieA } });
    const b = await app.request('/user-preferences', { headers: { cookie: cookieB } });
    const bodyA = (await a.json()) as { cipher_iv: string };
    const bodyB = (await b.json()) as { cipher_iv: string };
    expect(bodyA.cipher_iv).toBe('A-iv');
    expect(bodyB.cipher_iv).toBe('B-iv');
  });
});
