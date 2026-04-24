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

export async function createSession(userId: string): Promise<SessionRecord> {
  const { SESSION_TTL_SECONDS } = getConfig();
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const [row] = await db.insert(sessions).values({ id, userId, expiresAt }).returning();
  if (!row) throw new Error('failed to create session');
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

/**
 * Resolve a session id to its user. Returns null if the session does not
 * exist or has expired. Expired sessions are left in the table; a sweeper
 * can prune them out of band.
 */
export async function resolveSession(id: string): Promise<User | null> {
  const now = new Date();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
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
