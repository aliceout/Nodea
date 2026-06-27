/**
 * Dropbox OAuth2 (PKCE public client) — the connect handshake.
 *
 * WHAT  Opens the Dropbox consent popup, catches the auth code it posts back,
 *       and exchanges it (PKCE, no client secret) for tokens. Only the
 *       refresh token outlives this call — the caller seals it into the
 *       encrypted preferences.
 * WHERE `core/cloud-backup`: talks DIRECTLY to Dropbox domains, never the Nodea
 *       api (ADR-0017 — zero new backend; the `.age` is already E2E-encrypted,
 *       so the destination is untrusted by design). A sibling to `core/crypto`,
 *       deliberately NOT under `core/api` (which is for our own server).
 * ASSUMPTIONS (non-obvious, baked in)
 *   - **Popup, not full-page redirect.** A redirect would reload the SPA and
 *     drop the in-memory main key. A popup keeps THIS window (the opener) alive,
 *     so the PKCE verifier stays in a closure here and is NEVER persisted (no
 *     sessionStorage to leak it).
 *   - **`token_access_type=offline`** is what makes Dropbox return a
 *     refresh_token (without it you only get a ~4 h access token).
 *   - **App-folder confinement** comes from the Dropbox app's "App folder"
 *     access type, chosen at registration — not from an OAuth scope. The scope
 *     only needs `files.content.write` (Phase 2 upload writes the blob).
 *   - **`VITE_DROPBOX_CLIENT_ID`** is the public PKCE client id; the redirect
 *     URI is derived from the live origin (`/oauth/callback`), so dev (:8089)
 *     and prod share the code — only the Dropbox console must list both URIs.
 */
import { randomBytes, bytesToBase64Url } from '@/core/crypto/base64';

import { createPkcePair } from './pkce';

const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke';

/** Token bundle from the code exchange. `refreshToken` is the only one the
 *  caller keeps; `accessToken`/`expiresInSec` are handed back for a possible
 *  immediate use but Phase 1 discards them (a fresh one is minted on demand). */
export interface DropboxTokens {
  refreshToken: string;
  accessToken: string;
  expiresInSec: number;
}

function clientId(): string {
  const id = import.meta.env.VITE_DROPBOX_CLIENT_ID;
  if (!id) throw new Error('VITE_DROPBOX_CLIENT_ID is not configured');
  return id;
}

function redirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

/**
 * Open the consent popup and resolve with the auth code it postMessages back
 * (via the `OAuthCallback` leaf page). Rejects on user-deny, a popup the user
 * closed without authorising, or a blocked popup.
 */
function awaitAuthCode(url: string, expectedState: string): Promise<string> {
  const opened = window.open(url, 'dropbox-oauth', 'width=600,height=720');
  if (!opened) throw new Error('Popup blocked');
  // Re-bind as non-null: TS widens the guarded `opened` back to `Window | null`
  // inside the nested listener/interval closures below.
  const popup: Window = opened;

  return new Promise<string>((resolve, reject) => {
    const origin = window.location.origin;
    let settled = false;

    function cleanup(): void {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    }
    function onMessage(e: MessageEvent): void {
      // Trust only our own consent popup: `e.source !== popup` rejects any
      // other same-origin window/frame that could postMessage us, then the
      // origin check rejects cross-origin. Defence-in-depth — PKCE already
      // makes an injected code unusable at the token exchange.
      if (e.source !== popup) return;
      if (e.origin !== origin) return;
      const data = e.data as {
        type?: unknown;
        code?: unknown;
        error?: unknown;
        state?: unknown;
      };
      if (data?.type === 'oauth:code' && typeof data.code === 'string') {
        // CSRF nonce: ignore a code that didn't originate from THIS attempt.
        if (data.state !== expectedState) return;
        settled = true;
        cleanup();
        popup.close();
        resolve(data.code);
      } else if (data?.type === 'oauth:error') {
        settled = true;
        cleanup();
        popup.close();
        reject(
          new Error(typeof data.error === 'string' ? data.error : 'OAuth denied'),
        );
      }
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

/** Full connect handshake: PKCE → popup consent → code exchange → tokens. */
export async function connectDropbox(): Promise<DropboxTokens> {
  const { verifier, challenge } = await createPkcePair();
  // Per-attempt CSRF nonce, echoed back through the callback and matched in
  // awaitAuthCode (defence-in-depth on top of PKCE + the e.source filter).
  const state = bytesToBase64Url(randomBytes(16));
  const authParams = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    scope: 'files.content.write',
    state,
  });
  const code = await awaitAuthCode(
    `${AUTHORIZE_URL}?${authParams.toString()}`,
    state,
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      client_id: clientId(),
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Dropbox token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.refresh_token || !json.access_token) {
    throw new Error('Dropbox did not return a refresh token');
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresInSec: json.expires_in ?? 0,
  };
}

/** Exchange the stored refresh token for a fresh short-lived access token.
 *  The access token is never persisted — it's minted on demand before each
 *  upload (Phase 2). */
export async function refreshDropboxAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Dropbox token refresh failed (${res.status})`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error('Dropbox refresh returned no access token');
  }
  return { accessToken: json.access_token, expiresInSec: json.expires_in ?? 0 };
}

/**
 * Revoke the authorization at Dropbox so "disconnect" actually severs access,
 * not just forgets the token locally. The offline refresh token is long-lived
 * — it does NOT self-expire — so dropping it locally without this would leave a
 * fully valid token alive on Dropbox's side. Mints a short-lived access token
 * from the refresh token, then POSTs it to the revoke endpoint. The caller
 * treats this best-effort (clears locally even if it throws).
 */
export async function revokeDropboxAccess(refreshToken: string): Promise<void> {
  const { accessToken } = await refreshDropboxAccessToken(refreshToken);
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Dropbox token revoke failed (${res.status})`);
  }
}
