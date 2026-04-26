import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { getConfig } from '../config.ts';

export const SESSION_COOKIE = 'nodea_session';

/**
 * Multi-step register cookie (Auth-Spec.md §5.1).
 *
 * Carries a `register` session id during the multi-step inscription
 * flow. The `loadSession` middleware reads the cookie name to decide
 * which session kind to expect — this cookie maps to `kind='register'`.
 *
 * Naming note: the Auth-Spec calls for `__Host-nodea_register` to lock
 * the cookie to the apex domain and require Secure. The `__Host-`
 * prefix is incompatible with `COOKIE_SECURE=false` (dev over HTTP),
 * so V1 keeps the legacy un-prefixed naming for consistency with
 * `nodea_session`. Phase 8 cleanup renames all cookies to `__Host-*`
 * once HTTPS is mandatory in dev too.
 */
export const REGISTER_COOKIE = 'nodea_register';

export async function setSessionCookie(c: Context, sessionId: string, expiresAt: Date): Promise<void> {
  const { COOKIE_SECRET, COOKIE_SECURE } = getConfig();
  await setSignedCookie(c, SESSION_COOKIE, sessionId, COOKIE_SECRET, {
    httpOnly: true,
    sameSite: 'Lax',
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

export async function setRegisterCookie(
  c: Context,
  sessionId: string,
  expiresAt: Date,
): Promise<void> {
  const { COOKIE_SECRET, COOKIE_SECURE } = getConfig();
  await setSignedCookie(c, REGISTER_COOKIE, sessionId, COOKIE_SECRET, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: COOKIE_SECURE,
    path: '/',
    expires: expiresAt,
  });
}

export async function readRegisterCookie(c: Context): Promise<string | null> {
  const { COOKIE_SECRET } = getConfig();
  const value = await getSignedCookie(c, COOKIE_SECRET, REGISTER_COOKIE);
  return typeof value === 'string' ? value : null;
}

export function clearRegisterCookie(c: Context): void {
  const { COOKIE_SECURE } = getConfig();
  deleteCookie(c, REGISTER_COOKIE, {
    path: '/',
    secure: COOKIE_SECURE,
  });
}
