import { describe, it, expect, vi, afterEach } from 'vitest';

import type { CloudBackup } from '@nodea/shared';
import { pcloudProvider } from './pcloud';

// pCloud returns HTTP 200 with a JSON `result` code that is the REAL status, and
// `download` is a two-step getfilelink → fetch(host+path) dance. These pin that
// JSON-result handling (the bit a CORS/credential change could silently break)
// without a live account — the CORS assumption itself still needs first-live
// verification, as the provider header notes.
const cred: CloudBackup = {
  provider: 'pcloud',
  accessToken: 'tok',
  apiHost: 'eapi.pcloud.com',
};

describe('pcloud.download', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns null when the file is absent (result 2009)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: 2009 }))),
    );
    expect(await pcloudProvider.download(cred)).toBeNull();
  });

  it('resolves the link then fetches the bytes from the returned host (result 0)', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: 0, hosts: ['c123.pcloud.com'], path: '/x.age' }),
        ),
      )
      .mockResolvedValueOnce(new Response(bytes));
    vi.stubGlobal('fetch', fetchMock);

    const out = await pcloudProvider.download(cred);
    expect(out).toEqual(bytes);
    // Second fetch must target the link's own host + path, not the api host.
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://c123.pcloud.com/x.age');
  });

  it('throws on a non-zero, non-2009 result (never a false "no backup")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: 1000 }))),
    );
    await expect(pcloudProvider.download(cred)).rejects.toThrow(/getfilelink failed/);
  });

  it('throws when the link result omits hosts/path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: 0 }))),
    );
    await expect(pcloudProvider.download(cred)).rejects.toThrow(/getfilelink failed/);
  });
});
