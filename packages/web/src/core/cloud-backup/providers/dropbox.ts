/**
 * Dropbox provider — OAuth2 PKCE (public client) connect + app-folder upload.
 *
 * Implements the `CloudProvider` seam. Talks DIRECTLY to Dropbox (ADR-0017: no
 * backend; the `.age` is already E2E-encrypted, the destination untrusted by
 * design). Auth model: a long-lived OFFLINE refresh token is stored; a
 * short-lived access token is minted on demand before each upload and never
 * persisted.
 *
 * ASSUMPTIONS (baked in)
 *   - The consent popup + the same-origin/e.source trust checks live in the
 *     shared `awaitOAuthCallback` helper; the PKCE verifier stays in this
 *     closure and is NEVER persisted (popup keeps this window alive, so no
 *     redirect-reload drops the in-memory main key).
 *   - `token_access_type=offline` is what makes Dropbox return a refresh token.
 *   - App-folder confinement comes from the Dropbox app's "App folder" access
 *     type (registration-time), not a scope; the scope is `files.content.write`.
 *   - `VITE_DROPBOX_CLIENT_ID` is the public PKCE client id; the redirect URI is
 *     derived from the live origin (`/oauth/callback`).
 */
import type { CloudBackup } from '@nodea/shared';

import { randomBytes, bytesToBase64Url } from '@/core/crypto/base64';

import { awaitOAuthCallback } from '../oauth-popup';
import { createPkcePair } from '../pkce';
import { BACKUP_FILENAME, type CloudProvider } from '../types';

const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke';
const UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';

function clientId(): string {
  const id = import.meta.env.VITE_DROPBOX_CLIENT_ID;
  if (!id) throw new Error('VITE_DROPBOX_CLIENT_ID is not configured');
  return id;
}

function redirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

/** PKCE → popup consent → code exchange → the long-lived refresh token. */
async function connect(): Promise<CloudBackup> {
  const { verifier, challenge } = await createPkcePair();
  // Per-attempt CSRF nonce, echoed back through the callback and matched by the
  // popup helper (defence-in-depth on top of PKCE + the e.source filter).
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
  const result = await awaitOAuthCallback(
    `${AUTHORIZE_URL}?${authParams.toString()}`,
    'dropbox-oauth',
    { expectedState: state },
  );
  const code = result.get('code');
  if (!code) throw new Error('Dropbox returned no auth code');

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
  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) {
    throw new Error('Dropbox did not return a refresh token');
  }
  return { provider: 'dropbox', refreshToken: json.refresh_token };
}

/** Mint a fresh short-lived access token from the stored refresh token. Never
 *  persisted — re-derived before each upload/revoke. */
async function refreshAccessToken(refreshToken: string): Promise<string> {
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
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('Dropbox refresh returned no access token');
  }
  return json.access_token;
}

async function upload(cred: CloudBackup, bytes: Uint8Array): Promise<void> {
  if (cred.provider !== 'dropbox') throw new Error('dropbox.upload: wrong credential');
  const accessToken = await refreshAccessToken(cred.refreshToken);
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${BACKUP_FILENAME}`,
        mode: 'overwrite',
        mute: true,
      }),
    },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Dropbox upload failed (${res.status})`);
  }
}

/**
 * Revoke at Dropbox so "disconnect" actually severs access, not just forgets
 * the token locally — the offline refresh token is long-lived and does NOT
 * self-expire. Best-effort (the caller clears the local credential regardless).
 */
async function revoke(cred: CloudBackup): Promise<void> {
  if (cred.provider !== 'dropbox') return;
  const accessToken = await refreshAccessToken(cred.refreshToken);
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Dropbox token revoke failed (${res.status})`);
  }
}

export const dropboxProvider: CloudProvider = {
  id: 'dropbox',
  connectKind: 'oauth',
  connect,
  upload,
  revoke,
};
