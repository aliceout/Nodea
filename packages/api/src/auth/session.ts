import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
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
 * - `full`        : the runtime config `SESSION_TTL_SECONDS`
 *                   (default 7 days, fixed — Auth-Spec §5.1).
 * - `register`    : 24h — gives the user time to come back and finish a
 *                   multi-step inscription without retyping the email code.
 * - `mfa_pending` : 5 min — wired in Phase 5 (TOTP) and Phase 4 (passkey).
 * - `migrate`     : vestigial. Was used for the Phase 2C lazy
 *                   OPAQUE migration; the migration is complete
 *                   (Phase 2D dropped the legacy columns) and no
 *                   code path mints this kind any more. The value
 *                   stays in the union for DB enum compatibility.
 */
const REGISTER_TTL_SECONDS = 24 * 60 * 60;
const MFA_PENDING_TTL_SECONDS = 5 * 60;

export type SessionKind = 'full' | 'mfa_pending' | 'register' | 'migrate';

/** Per-factor verification flags carried on `mfa_pending` rows.
 *  At least one is set when the session is minted (the primary
 *  factor that just succeeded); `/auth/mfa/*` routes flip the
 *  remaining ones until `finalizeMfaSession` promotes to `full`. */
export interface MfaVerifiedFlags {
  mfaPasswordVerified?: boolean;
  mfaPasskeyVerified?: boolean;
  mfaTotpVerified?: boolean;
}

/** Mark the session as fresh wrt one or both factors at creation
 *  time. Drives the `requireFreshPassword` /
 *  `requireFreshPasswordOrPasskey` middleware checks via the
 *  `reauth_password_at` / `reauth_passkey_at` columns
 *  (Auth-Spec §5.3, §6). */
export interface ReauthFreshFlags {
  password?: boolean;
  passkey?: boolean;
}

export interface CreateSessionOptions {
  kind?: SessionKind;
  /** Override the default TTL for this kind. Useful for tests. */
  ttlSeconds?: number;
  /** Pre-set MFA verification flags (mfa_pending sessions only).
   *  Phase 5C uses this to mint a pending row with the primary
   *  factor (password OR passkey) already marked verified. */
  mfaFlags?: MfaVerifiedFlags;
  /** Stamp `reauth_*_at = now` for the listed factors at insert
   *  (Phase 7A). Used by every auth path that promotes to / mints
   *  a `full` session: direct password login, direct passkey
   *  login, change-password rotation, recovery-code reset, and
   *  the dedicated `/auth/reauth/*` endpoints. */
  reauthFresh?: ReauthFreshFlags;
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
      : kind === 'mfa_pending'
        ? MFA_PENDING_TTL_SECONDS
        : getConfig().SESSION_TTL_SECONDS);
  const id = newSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const flags = opts.mfaFlags ?? {};
  const reauth = opts.reauthFresh ?? {};
  const [row] = await db
    .insert(sessions)
    .values({
      id,
      userId,
      expiresAt,
      kind,
      mfaPasswordVerified: flags.mfaPasswordVerified ?? false,
      mfaPasskeyVerified: flags.mfaPasskeyVerified ?? false,
      mfaTotpVerified: flags.mfaTotpVerified ?? false,
      reauthPasswordAt: reauth.password ? now : null,
      reauthPasskeyAt: reauth.passkey ? now : null,
    })
    .returning();
  if (!row) throw new Error('failed to create session');
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

/**
 * Bump `reauth_password_at` or `reauth_passkey_at` on an existing
 * session. Used by `/auth/reauth/password` and `/auth/reauth/passkey`
 * after they verify a fresh proof, and anywhere a mutating action
 * proves a factor inline (e.g. change-password / change-mode).
 */
export async function bumpSessionReauth(
  sessionId: string,
  factor: 'password' | 'passkey',
): Promise<void> {
  const now = new Date();
  await db
    .update(sessions)
    .set(
      factor === 'password'
        ? { reauthPasswordAt: now }
        : { reauthPasskeyAt: now },
    )
    .where(eq(sessions.id, sessionId));
}

/**
 * Read the per-factor freshness timestamps off a session. Used by
 * `requireFreshPassword` / `requireFreshPasswordOrPasskey` to gate
 * mutating actions per Auth-Spec §6. Returns `null` if the session
 * does not exist (the caller should already have rejected via
 * `requireUser`).
 */
export async function getSessionReauth(
  sessionId: string,
): Promise<{ password: Date | null; passkey: Date | null } | null> {
  const [row] = await db
    .select({
      password: sessions.reauthPasswordAt,
      passkey: sessions.reauthPasskeyAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  return { password: row.password, passkey: row.passkey };
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
/** Don't rewrite `last_seen_at` more than once per 5 minutes per
 *  session — liveness display doesn't need per-request precision,
 *  and an UPDATE per request would double the write load. */
const LAST_SEEN_STALE_MS = 5 * 60_000;

export async function resolveSession(
  id: string,
  expectedKind: SessionKind = 'full',
): Promise<User | null> {
  const now = new Date();
  // Fixed cap (Auth-Spec §5.1, "no slide") : a session is invalid once
  // it is older than the TTL, regardless of its stored `expires_at`.
  // This enforces the 7-day cutoff from `created_at` even on rows
  // minted under a longer legacy TTL. Short-lived kinds (register /
  // mfa_pending) are always younger than this cutoff, so it's a no-op
  // for them — their own `expires_at` bites first.
  const capCutoff = new Date(
    now.getTime() - getConfig().SESSION_TTL_SECONDS * 1000,
  );
  const [row] = await db
    .select({ user: users, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.kind, expectedKind),
        gt(sessions.expiresAt, now),
        gt(sessions.createdAt, capCutoff),
      ),
    )
    .limit(1);
  if (!row) return null;

  // Liveness stamp (audit 2026-06) : `last_seen_at` existed in the
  // schema and was read by /auth/sessions but never written — the
  // « dernière activité » column stayed empty forever. Throttled +
  // fire-and-forget : the request never waits on it and a missed
  // stamp costs nothing.
  if (
    !row.lastSeenAt ||
    now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_STALE_MS
  ) {
    void db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, id))
      .catch(() => {
        // Liveness metadata only — losing one stamp is harmless.
      });
  }

  return row.user;
}

export async function revokeSession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Promote an `mfa_pending` session row to a fresh `full` session.
 *
 * Used at the end of stepped MFA (Auth-Spec §7.4) once all factors
 * required by `users.security_mode` have been verified. Atomically
 * deletes the pending row + inserts a new full row in a transaction
 * so a network drop between the two steps doesn't leave the user
 * authenticated with two competing sessions.
 *
 * The caller is responsible for swapping the cookie via
 * `setSessionCookie` after this returns — we don't touch
 * `Set-Cookie` here because Hono's context isn't in scope.
 */
export async function finalizeMfaSession(
  pendingSessionId: string,
): Promise<SessionRecord> {
  const ttlSeconds = getConfig().SESSION_TTL_SECONDS;
  const id = newSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select({
        userId: sessions.userId,
        mfaPasswordVerified: sessions.mfaPasswordVerified,
        mfaPasskeyVerified: sessions.mfaPasskeyVerified,
      })
      .from(sessions)
      .where(eq(sessions.id, pendingSessionId))
      .limit(1);
    if (!pending) {
      throw new Error('finalizeMfaSession: pending session not found');
    }
    await tx.delete(sessions).where(eq(sessions.id, pendingSessionId));
    const [row] = await tx
      .insert(sessions)
      .values({
        id,
        userId: pending.userId,
        expiresAt,
        kind: 'full',
        // Propagate factor freshness from the pending row: whichever
        // primary / step proved a factor stamps the corresponding
        // `reauth_*_at` on the brand-new full row, so the user
        // doesn't have to immediately re-prove to mutate Settings.
        reauthPasswordAt: pending.mfaPasswordVerified ? now : null,
        reauthPasskeyAt: pending.mfaPasskeyVerified ? now : null,
      })
      .returning();
    if (!row) throw new Error('finalizeMfaSession: failed to insert full session');
    return { id: row.id, userId: row.userId, expiresAt: row.expiresAt };
  });
}
