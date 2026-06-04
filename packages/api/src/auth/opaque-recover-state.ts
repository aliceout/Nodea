/**
 * Per-process state holder for the recovery-code KEK 2-step flow
 * (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * `/auth/recover-kek/start` returns a `recoverSessionId`; the
 * client comes back with it at `/auth/recover-kek/finish`. The
 * stored entry binds the session to a `userId` (or `null` for
 * unknown-email cases — the anti-enum trail) so /finish can refuse
 * before touching any credential row.
 *
 * Single-use, 5-min TTL, in-memory. Same trade-off as
 * `opaque-login-state.ts` / `opaque-pending-state.ts`: V1 ships
 * single-instance, multi-instance moves to Redis later.
 */
import { randomBytes } from 'node:crypto';

const TTL_MS = 5 * 60 * 1000;

interface PendingEntry {
  /** Bound user. `null` = anti-enum branch from /start (unknown
   *  email or no recovery code) — /finish will refuse uniformly. */
  userId: string | null;
  expiresAt: number;
}

// Shared via globalThis so Vitest 4's per-file module re-evaluation
// doesn't fragment the Map between routes and test hooks ; production
// has a single instance so the registry is a no-op there.
const pending: Map<string, PendingEntry> =
  ((globalThis as { __nodea_opaque_recover_state__?: Map<string, PendingEntry> })
    .__nodea_opaque_recover_state__ ??= new Map<string, PendingEntry>());

export function storeRecoverPending(userId: string | null): string {
  const token = randomBytes(32).toString('base64url');
  pending.set(token, { userId, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeRecoverPending(token: string): PendingEntry | null {
  const entry = pending.get(token);
  if (!entry) return null;
  pending.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

export function __resetRecoverStates(): void {
  pending.clear();
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(token);
  }
}, 60_000);
sweep.unref?.();
