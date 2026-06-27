/**
 * pCloud provider — OAuth2 implicit (token) flow + multipart upload.
 *
 * Implements the `CloudProvider` seam. A genuine second Dropbox-class provider
 * (Swiss/EU, privacy-marketed): browser-direct, no client secret, the Nodea
 * server never in the loop, and — crucially — pCloud access tokens DO NOT
 * EXPIRE, so unattended auto-backup works without any refresh dance.
 *
 * NON-OBVIOUS / VERIFY-ON-FIRST-LIVE-UPLOAD
 *   - **Implicit flow**: the token comes back in the redirect FRAGMENT
 *     (`#access_token=…`), not a `?code=`. `OAuthCallback` forwards both, so the
 *     shared popup helper hands us the fragment params.
 *   - **Two API regions**: the callback returns `hostname` (or `locationid`
 *     1=US/2=EU); we route uploads to that host (`api.pcloud.com` /
 *     `eapi.pcloud.com`).
 *   - **CORS = simple request only**: pCloud answers cross-origin ONLY for a
 *     "simple" request (multipart/form-data, NO custom headers). So the token +
 *     target go in the QUERY STRING and the file is the sole form part — adding
 *     an `Authorization` or custom `Content-Type` header would trigger a
 *     preflight pCloud rejects.
 *   - **Overwrite**: `renameifexists` is omitted so pCloud replaces the
 *     same-named file in place (our single rolling backup). VERIFY on the first
 *     real upload that it rolls rather than spawning `… (1).age`.
 *   - `VITE_PCLOUD_CLIENT_ID` is the public app id (no secret).
 */
import type { CloudBackup } from '@nodea/shared';

import { randomBytes, bytesToBase64Url } from '@/core/crypto/base64';

import { awaitOAuthCallback } from '../oauth-popup';
import { BACKUP_FILENAME, type CloudProvider } from '../types';

const AUTHORIZE_URL = 'https://my.pcloud.com/oauth2/authorize';
const HOST_US = 'api.pcloud.com';
const HOST_EU = 'eapi.pcloud.com';

function clientId(): string {
  const id = import.meta.env.VITE_PCLOUD_CLIENT_ID;
  if (!id) throw new Error('VITE_PCLOUD_CLIENT_ID is not configured');
  return id;
}

function redirectUri(): string {
  return `${window.location.origin}/oauth/callback`;
}

async function connect(): Promise<CloudBackup> {
  const state = bytesToBase64Url(randomBytes(16));
  const authParams = new URLSearchParams({
    client_id: clientId(),
    response_type: 'token',
    redirect_uri: redirectUri(),
    state,
  });
  // We rely on the popup e.source check for trust; pCloud's `state` echo is not
  // guaranteed, so we don't enforce it (no `expectedState`).
  const result = await awaitOAuthCallback(
    `${AUTHORIZE_URL}?${authParams.toString()}`,
    'pcloud-oauth',
  );
  const accessToken = result.get('access_token');
  if (!accessToken) {
    throw new Error('pCloud returned no access token');
  }
  const hostname = result.get('hostname');
  const locationid = result.get('locationid');
  const apiHost = hostname ?? (locationid === '2' ? HOST_EU : HOST_US);
  return { provider: 'pcloud', accessToken, apiHost };
}

async function upload(cred: CloudBackup, bytes: Uint8Array): Promise<void> {
  if (cred.provider !== 'pcloud') throw new Error('pcloud.upload: wrong credential');
  const query = new URLSearchParams({
    access_token: cred.accessToken,
    path: '/',
    filename: BACKUP_FILENAME,
    nopartial: '1',
  });
  const form = new FormData();
  form.append('file', new Blob([bytes as BlobPart]), BACKUP_FILENAME);
  const res = await fetch(`https://${cred.apiHost}/uploadfile?${query.toString()}`, {
    method: 'POST',
    body: form,
  });
  // pCloud returns HTTP 200 even on logical errors; the JSON `result` is the
  // real status (0 = OK). The response is CORS-readable (simple request).
  const json = (await res.json().catch(() => null)) as
    | { result?: number; error?: string }
    | null;
  if (!res.ok || !json || json.result !== 0) {
    throw new Error(`pCloud upload failed (${json?.error ?? res.status})`);
  }
}

// No `revoke`: pCloud has no browser-callable token-revocation endpoint.
// Disconnect just clears the local token (the caller does that); the user can
// revoke the app from their pCloud account settings.

export const pcloudProvider: CloudProvider = {
  id: 'pcloud',
  connectKind: 'oauth',
  connect,
  upload,
};
