/**
 * Shared OAuth popup driver for the cloud-backup providers.
 *
 * WHAT  Opens a provider's consent URL in a popup and resolves with the params
 *       the `OAuthCallback` leaf page posts back (merged query + fragment). Both
 *       the code-flow providers (Dropbox: reads `code`) and the implicit/token-
 *       flow providers (pCloud: reads `access_token`) use this — they just pull
 *       different params from the result.
 * WHY   The security-sensitive bit (only trust the popup WE opened, same-origin)
 *       lives in ONE place rather than copied per provider.
 *
 * SECURITY  Trusts a message only if its `source` is the popup we opened AND its
 * `origin` is our own (the same-origin `OAuthCallback`). An optional
 * `expectedState` adds the CSRF-nonce check for providers that echo `state`
 * (Dropbox). PKCE on top is each provider's own business.
 */
export interface OAuthCallbackParams {
  get(key: string): string | null;
}

export function awaitOAuthCallback(
  url: string,
  popupName: string,
  opts: { expectedState?: string } = {},
): Promise<OAuthCallbackParams> {
  const opened = window.open(url, popupName, 'width=600,height=720');
  if (!opened) throw new Error('Popup blocked');
  // Re-bind as non-null: TS widens the guarded `opened` back to `Window | null`
  // inside the nested listener/interval closures below.
  const popup: Window = opened;

  return new Promise<OAuthCallbackParams>((resolve, reject) => {
    const origin = window.location.origin;
    let settled = false;

    function cleanup(): void {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    }
    function onMessage(e: MessageEvent): void {
      // Only our own consent popup, same-origin. Anything else is ignored.
      if (e.source !== popup) return;
      if (e.origin !== origin) return;
      const data = e.data as { type?: unknown; params?: unknown };
      if (data?.type !== 'oauth:result') return;
      if (typeof data.params !== 'object' || data.params === null) return;
      const params = new URLSearchParams(data.params as Record<string, string>);
      // Optional CSRF nonce: ignore a callback that didn't carry THIS attempt's
      // state (only enforced for providers that echo it).
      if (opts.expectedState && params.get('state') !== opts.expectedState) return;
      settled = true;
      cleanup();
      popup.close();
      const err = params.get('error');
      if (err) {
        reject(new Error(err));
        return;
      }
      resolve({ get: (k) => params.get(k) });
    }
    const closedTimer = window.setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error('Popup closed'));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}
