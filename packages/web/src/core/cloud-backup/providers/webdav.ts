/**
 * WebDAV / Nextcloud provider — HTTP Basic (app-password) + a single PUT.
 *
 * Implements the `CloudProvider` seam with `connectKind: 'credentials'`: there
 * is no OAuth. The user pastes their Nextcloud server URL, login name and a
 * Nextcloud *app-password* (Settings → Security → Devices & sessions); the
 * browser then talks STRAIGHT to `…/remote.php/dav` — no Nodea server, no
 * shared secret (ADR-0017). The `.age` is already E2E-encrypted, so the
 * destination is untrusted by design.
 *
 * WHY THIS ONE NEEDS SERVER-SIDE SETUP (Dropbox/pCloud don't): vanilla Nextcloud
 * sends NO CORS headers on `remote.php/dav`, so a cross-origin browser request
 * is blocked at the preflight. The Nextcloud admin must install the community
 * app **webapppassword** (digital-blueprint) and whitelist Nodea's exact origin.
 * That app injects a Sabre plugin which answers the OPTIONS preflight (204,
 * pre-auth) and reflects `Allow-Methods`/`Allow-Headers` with
 * `Allow-Credentials: true` + an exact-origin `Allow-Origin` — verified against
 * its source (`CorsPlugin.php`). ⇒ WebDAV is the self-hoster / advanced option;
 * on a managed/shared Nextcloud the user can't do that setup and connect fails.
 *
 * ASSUMPTIONS (baked in)
 *   - login name == the dav path segment (`/files/<login>/`). Holds for standard
 *     accounts; a SAML/LDAP install where the internal user-id differs from the
 *     login could break the path (documented edge case, not handled here).
 *   - Auth is the `Authorization` header, NOT cookies → `credentials: 'omit'` so
 *     we never pull a session cookie into the cross-origin request (keeps the
 *     CORS contract simple; the Basic header still travels regardless).
 *   - One rolling file at the dav root — no MKCOL: the user's files root always
 *     exists, so there's no folder to create and no 409 to handle.
 */
import type { CloudBackup, WebdavCredentials } from '@nodea/shared';

import { bytesToBase64 } from '@/core/crypto/base64';

import { BACKUP_FILENAME, type CloudProvider } from '../types';

type WebdavCred = Extract<CloudBackup, { provider: 'webdav' }>;

/** Connect-failure cause, so the form shows actionable copy instead of one
 *  opaque "try again" — the CORS failure is browser-indistinguishable from a
 *  network outage (no readable HTTP status), so we can only enumerate causes. */
export type WebdavErrorCode = 'cors' | 'auth' | 'path';

export class WebdavError extends Error {
  constructor(
    readonly code: WebdavErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WebdavError';
  }
}

/** Strip a trailing slash and any pasted `/remote.php/…` tail, so we always
 *  rebuild the dav URL from a clean origin(+subpath) base. Exported for tests. */
export function normalizeBaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/remote\.php\/.*$/, '')
    .replace(/\/+$/, '');
}

function davRootUrl(cred: WebdavCred): string {
  return `${cred.baseUrl}/remote.php/dav/files/${encodeURIComponent(cred.username)}/`;
}

function davFileUrl(cred: WebdavCred): string {
  return `${davRootUrl(cred)}${encodeURIComponent(BACKUP_FILENAME)}`;
}

/** `Basic base64(user:appPassword)`. Exported for tests. */
export function basicAuth(cred: WebdavCred): string {
  // btoa() rejects non-latin1 (a unicode login), so go through the shared UTF-8
  // base64 encoder — the single source of truth for base64 in the codebase.
  const raw = new TextEncoder().encode(`${cred.username}:${cred.appPassword}`);
  return `Basic ${bytesToBase64(raw)}`;
}

/** Read-only PROPFIND Depth:0 on the user root — exercises the exact CORS +
 *  preflight + auth path the upload will use, writing nothing. 207 = valid. */
async function validate(cred: WebdavCred): Promise<void> {
  let res: Response;
  try {
    res = await fetch(davRootUrl(cred), {
      method: 'PROPFIND',
      headers: { Authorization: basicAuth(cred), Depth: '0' },
      credentials: 'omit',
    });
  } catch {
    // A thrown TypeError is the opaque CORS/preflight/network failure: the
    // webapppassword app isn't installed, this origin isn't whitelisted, the
    // URL is wrong, or the server is unreachable — indistinguishable from here.
    throw new WebdavError('cors', 'webdav: request blocked (CORS or network)');
  }
  if (res.status === 207) return; // Multi-Status → URL + login + credential valid
  if (res.status === 401 || res.status === 403) {
    throw new WebdavError('auth', `webdav: auth rejected (${res.status})`);
  }
  throw new WebdavError('path', `webdav: unexpected status (${res.status})`);
}

async function connect(input?: WebdavCredentials): Promise<CloudBackup> {
  if (!input) throw new Error('webdav.connect: credentials required');
  const cred: WebdavCred = {
    provider: 'webdav',
    baseUrl: normalizeBaseUrl(input.baseUrl),
    username: input.username.trim(),
    appPassword: input.appPassword.trim(),
  };
  await validate(cred);
  return cred;
}

async function upload(cred: CloudBackup, bytes: Uint8Array): Promise<void> {
  if (cred.provider !== 'webdav') throw new Error('webdav.upload: wrong credential');
  const res = await fetch(davFileUrl(cred), {
    method: 'PUT',
    headers: {
      Authorization: basicAuth(cred),
      'Content-Type': 'application/octet-stream',
    },
    body: bytes as BodyInit,
    credentials: 'omit',
  });
  // 201 Created (new) or 204 No Content (overwrite) are both success.
  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`webdav upload failed (${res.status})`);
  }
}

// No `revoke`: a Nextcloud app-password is revoked from the server (Settings →
// Security → Devices & sessions); disconnect just clears the local credential.

export const webdavProvider: CloudProvider = {
  id: 'webdav',
  connectKind: 'credentials',
  connect,
  upload,
};
