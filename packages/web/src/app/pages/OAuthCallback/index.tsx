import { useEffect } from 'react';

/**
 * OAuth redirect landing — a public leaf rendered ONLY inside the consent
 * popup. It reads `?code` / `?error` off the URL, postMessages the result to
 * the opener (same-origin target, never `*`), and closes itself. No auth, no
 * Layout, no main key: it must work in a bare popup that never loaded the app
 * shell. The opener (`connectDropbox`) owns the PKCE verifier and the token
 * exchange — this page only ferries the code across the window boundary.
 */
export default function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const opener = window.opener as Window | null;
    if (opener) {
      const message = code
        ? { type: 'oauth:code', code }
        : { type: 'oauth:error', error: error ?? 'unknown' };
      opener.postMessage(message, window.location.origin);
    }
    window.close();
  }, []);

  return <div className="p-6 text-center opacity-60">…</div>;
}
