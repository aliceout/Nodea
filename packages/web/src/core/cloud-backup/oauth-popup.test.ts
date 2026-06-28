// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import { awaitOAuthCallback } from './oauth-popup';

// awaitOAuthCallback is the single trust choke point for every OAuth connect:
// it must trust a postMessage ONLY if it came from the popup WE opened, from our
// OWN origin, and (when set) carries THIS attempt's state nonce. These pin those
// three guards so a future refactor can't silently drop one. We force the event's
// `source` via defineProperty because jsdom nulls a non-Window init source.

function fakePopup(): Window {
  return { closed: false, close: vi.fn() } as unknown as Window;
}

function post(
  source: Window,
  origin: string,
  params: Record<string, string>,
): void {
  const ev = new MessageEvent('message', {
    origin,
    data: { type: 'oauth:result', params },
  });
  Object.defineProperty(ev, 'source', { value: source, configurable: true });
  window.dispatchEvent(ev);
}

describe('awaitOAuthCallback', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws synchronously when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => awaitOAuthCallback('https://provider/auth', 'p')).toThrow(/blocked/i);
  });

  it('ignores a message from a foreign source, resolves the real popup', async () => {
    const popup = fakePopup();
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const p = awaitOAuthCallback('https://provider/auth', 'p');
    post(fakePopup(), window.location.origin, { code: 'EVIL' }); // different object
    post(popup, window.location.origin, { code: 'REAL' });
    expect((await p).get('code')).toBe('REAL');
  });

  it('ignores a message from a foreign origin', async () => {
    const popup = fakePopup();
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const p = awaitOAuthCallback('https://provider/auth', 'p');
    post(popup, 'https://evil.example', { code: 'EVIL' });
    post(popup, window.location.origin, { code: 'REAL' });
    expect((await p).get('code')).toBe('REAL');
  });

  it('ignores a state mismatch when expectedState is set', async () => {
    const popup = fakePopup();
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const p = awaitOAuthCallback('https://provider/auth', 'p', { expectedState: 'S1' });
    post(popup, window.location.origin, { code: 'EVIL', state: 'WRONG' });
    post(popup, window.location.origin, { code: 'REAL', state: 'S1' });
    expect((await p).get('code')).toBe('REAL');
  });

  it('rejects when the callback carries an error param', async () => {
    const popup = fakePopup();
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const p = awaitOAuthCallback('https://provider/auth', 'p');
    post(popup, window.location.origin, { error: 'access_denied' });
    await expect(p).rejects.toThrow('access_denied');
  });
});
