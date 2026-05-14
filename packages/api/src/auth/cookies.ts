import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { getConfig } from '../config.ts';

export const SESSION_COOKIE = 'nodea_session';

export async function setSessionCookie(c: Context, sessionId: string, expiresAt: Date): Promise<void> {
  const { COOKIE_SECRET, COOKIE_SECURE } = getConfig();
  await setSignedCookie(c, SESSION_COOKIE, sessionId, COOKIE_SECRET, {
    httpOnly: true,
    // SameSite=Strict (SEC-08) — refuse to send the session cookie on
    // any cross-site navigation (links from external sites, embeds,
    // etc). Nodea is a SPA with no cross-site navigation needs : every
    // user-facing flow lives at the same origin. Email magic links
    // (activation / reset / MFA bypass confirm) work fine because they
    // SET a cookie on the response rather than READ one on the request,
    // and once landed the SPA stays same-origin.
    //
    // Tighter than `Lax` against the future scenario where a CSP
    // bypass + sub-domain takeover would let a malicious script send
    // requests with credentials. `Lax` would carry the cookie on
    // top-level GET ; `Strict` doesn't.
    sameSite: 'Strict',
    secure: COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
  });
}

export async function readSessionCookie(c: Context): Promise<string | null> {
  const { COOKIE_SECRET } = getConfig();
  const value = await getSignedCookie(c, COOKIE_SECRET, SESSION_COOKIE);
  return typeof value === 'string' ? value : null;
}

export function clearSessionCookie(c: Context): void {
  const { COOKIE_SECURE } = getConfig();
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
    secure: COOKIE_SECURE,
  });
}
