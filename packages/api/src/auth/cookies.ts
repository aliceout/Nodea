import type { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { getConfig } from '../config.ts';

export const SESSION_COOKIE = 'nodea_session';

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
