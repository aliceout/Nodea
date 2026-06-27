import { useEffect } from 'react';

/**
 * OAuth redirect landing — a public leaf rendered ONLY inside the consent
 * popup. It merges the redirect's query (`?code=…`, code-flow / Dropbox) AND
 * fragment (`#access_token=…`, implicit-flow / pCloud) params, postMessages
 * them to the opener (same-origin target, never `*`), and closes itself. No
 * auth, no Layout, no main key: it must work in a bare popup that never loaded
 * the app shell. The opener (`awaitOAuthCallback`) owns the trust checks + the
 * token exchange — this page only ferries the params across the window boundary.
 */
export default function OAuthCallback() {
  useEffect(() => {
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(window.location.search)) params[k] = v;
    // Implicit-flow tokens come back in the fragment, not the query.
    for (const [k, v] of new URLSearchParams(window.location.hash.replace(/^#/, '')))
      params[k] = v;

    const opener = window.opener as Window | null;
    if (opener) {
      opener.postMessage({ type: 'oauth:result', params }, window.location.origin);
    }
    window.close();
  }, []);

  return <div className="p-6 text-center opacity-60">…</div>;
}
