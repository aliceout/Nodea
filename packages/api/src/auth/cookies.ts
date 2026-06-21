import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { getConfig } from '../config.ts';

/**
 * Session cookie name. When the cookie is Secure (prod —
 * `COOKIE_SECURE=true`) we use the `__Host-` prefix (Auth-Spec §11):
 * the browser then enforces that the cookie is host-locked (no
 * `Domain`), `Path=/` and `Secure`, so no compromised sibling / parent
 * subdomain can inject or shadow the session. The prefix REQUIRES the
 * `Secure` attribute, so on a plain-http dev origin
 * (`COOKIE_SECURE=false`) we fall back to the unprefixed name — a
 * `__Host-` cookie would otherwise be silently dropped by the browser
 * and break dev login.
 *
 * Consequence: a deployment moving to Secure (or upgrading past this
 * change) renames the cookie once, so live sessions are dropped and
 * users sign in again a single time. Accepted for a security hardening.
 */
function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-nodea_session' : 'nodea_session';
}

export async function setSessionCookie(c: Context, sessionId: string, expiresAt: Date): Promise<void> {
  const { COOKIE_SECRET, COOKIE_SECURE } = getConfig();
  await setSignedCookie(c, sessionCookieName(COOKIE_SECURE), sessionId, COOKIE_SECRET, {
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
  const { COOKIE_SECRET, COOKIE_SECURE } = getConfig();
  const value = await getSignedCookie(c, COOKIE_SECRET, sessionCookieName(COOKIE_SECURE));
  return typeof value === 'string' ? value : null;
}

export function clearSessionCookie(c: Context): void {
  const { COOKIE_SECURE } = getConfig();
  deleteCookie(c, sessionCookieName(COOKIE_SECURE), {
    path: '/',
    secure: COOKIE_SECURE,
  });
}
