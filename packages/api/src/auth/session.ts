import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { sessions, users, type User } from '../db/schema.ts';
import { getConfig } from '../config.ts';

/** 32 bytes → 256 bits of entropy. Base64url-encoded for cookie safety. */
function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Default TTLs per session kind (Auth-Spec.md §5.1).
 *
 * - `full`        : the runtime config `SESSION_TTL_SECONDS` (legacy default
 *                   30 days; Auth-Spec target is 7 days fixed, flipped in
 *                   Phase 2 of the roadmap).
 * - `register`    : 24h — gives the user time to come back and finish a
 *                   multi-step inscription without retyping the email code.
 * - `mfa_pending` : 5 min — wired in Phase 5 (TOTP) and Phase 4 (passkey).
 * - `migrate`     : 30 min — wired in Phase 2 (lazy OPAQUE migration).
 */
const REGISTER_TTL_SECONDS = 24 * 60 * 60;

export type SessionKind = 'full' | 'mfa_pending' | 'register' | 'migrate';

export interface CreateSessionOptions {
  kind?: SessionKind;
  /** Override the default TTL for this kind. Useful for tests. */
  ttlSeconds?: number;
}

export async function createSession(
  userId: string,
  opts: CreateSessionOptions = {},
): Promise<SessionRecord> {
  const kind = opts.kind ?? 'full';
  const ttlSeconds =
    opts.ttlSeconds ??
    (kind === 'register'
      ? REGISTER_TTL_SECONDS
      : getConfig().SESSION_TTL_SECONDS);
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const [row] = await db
    .insert(sessions)
    .values({ id, userId, expiresAt, kind })
    .returning();
  if (!row) throw new Error('failed to create session');
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

/**
 * Resolve a session id to its user. Returns null if the session does not
 * exist or has expired. Expired sessions are left in the table; a sweeper
 * can prune them out of band.
 *
 * Defaults to `kind='full'` since this is by far the most common path.
 * Pass an explicit `kind` to validate against `register`, `mfa_pending`,
 * or `migrate` sessions — mismatched kinds return null (the caller's
 * middleware decides which 401 message to surface).
 */
export async function resolveSession(
  id: string,
  expectedKind: SessionKind = 'full',
): Promise<User | null> {
  const now = new Date();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.kind, expectedKind),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);
  return row?.user ?? null;
}

export async function revokeSession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Housekeeping — remove expired rows. Safe to call on an interval. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return result.length;
}
