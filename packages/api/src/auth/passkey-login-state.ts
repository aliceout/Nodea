/**
 * Per-process state holder for the passkey login 2-step flow
 * (Auth-Roadmap Phase 4, Auth-Spec §7.3).
 *
 * `/auth/passkey/login/start` returns a `loginToken`; the client
 * comes back with it at `/auth/passkey/login/finish`. The stored
 * entry binds the token to the WebAuthn `challenge` (and an
 * optional `userId` when the start was email-bound) so /finish can
 * verify the assertion was produced for the challenge we issued —
 * not one replayed from another flow.
 *
 * Single-use, 5-min TTL, in-memory. Same trade-off as the rest of
 * the auth state files: V1 ships single-instance, multi-instance
 * moves to Redis later.
 */
import { randomBytes } from 'node:crypto';

const TTL_MS = 5 * 60 * 1000;

interface PendingEntry {
  /** WebAuthn challenge (base64url) issued at /start. /finish must
   *  see the same challenge inside the assertion's `clientDataJSON`. */
  challenge: string;
  /** Bound user id when /start received an email — the assertion
   *  must come from one of this user's credentials. `null` for the
   *  discoverable-credential path: /finish picks the user from the
   *  credential id the assertion contains. */
  userId: string | null;
  expiresAt: number;
}

const pending = new Map<string, PendingEntry>();

export function storePasskeyLoginPending(
  challenge: string,
  userId: string | null,
): string {
  const token = randomBytes(32).toString('base64url');
  pending.set(token, { challenge, userId, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumePasskeyLoginPending(token: string): PendingEntry | null {
  const entry = pending.get(token);
  if (!entry) return null;
  pending.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function __resetPasskeyLoginStates(): void {
  pending.clear();
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(token);
  }
}, 60_000);
sweep.unref?.();
