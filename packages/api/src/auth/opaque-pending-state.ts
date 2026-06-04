/**
 * Per-process state holders for OPAQUE handshakes that span two HTTP
 * round-trips (Auth-Roadmap Phase 2C/2D).
 *
 * Each flow gets its own map, all keyed on a single-use base64url
 * token (256 bits). Single-instance V1 — Redis later if we scale out.
 *
 * Login already has its own narrower file (`opaque-login-state.ts`);
 * change-password and reset share the same shape but bind to
 * `userId` rather than email so the binding survives an email
 * change between /start and /finish (though that's not currently
 * possible since the routes are scoped to the calling user).
 */
import { randomBytes } from 'node:crypto';

const TTL_MS = 5 * 60 * 1000;

interface PendingEntry {
  /** User this flow is rotating credentials for. */
  userId: string;
  /** Was here for future debugging. Not load-bearing. */
  email: string;
  expiresAt: number;
}

// Vitest 4 re-evaluates this module per test file even with
// `isolate: false` ; route handlers and test setup hooks would
// end up with separate Maps, dropping pending tokens between
// /start and /finish. Stash the Maps on globalThis so every
// re-evaluation references the same underlying store. Production
// has a single module instance — the registry is a no-op there.
const __g = globalThis as {
  __nodea_opaque_change_password_pending__?: Map<string, PendingEntry>;
  __nodea_opaque_reset_pending__?: Map<string, PendingEntry>;
};
const changePasswordPending: Map<string, PendingEntry> =
  (__g.__nodea_opaque_change_password_pending__ ??= new Map<string, PendingEntry>());
const resetPending: Map<string, PendingEntry> =
  (__g.__nodea_opaque_reset_pending__ ??= new Map<string, PendingEntry>());

function freshToken(): string {
  return randomBytes(32).toString('base64url');
}

function consume(
  store: Map<string, PendingEntry>,
  token: string,
): PendingEntry | null {
  const entry = store.get(token);
  if (!entry) return null;
  store.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

function store(
  map: Map<string, PendingEntry>,
  userId: string,
  email: string,
): string {
  const token = freshToken();
  map.set(token, { userId, email, expiresAt: Date.now() + TTL_MS });
  return token;
}

/* ---- change-password ----------------------------------------------- */

export function storeChangePasswordPending(userId: string, email: string): string {
  return store(changePasswordPending, userId, email);
}

export function consumeChangePasswordPending(token: string): PendingEntry | null {
  return consume(changePasswordPending, token);
}

/* ---- reset-password ------------------------------------------------ */

export function storeResetPending(userId: string, email: string): string {
  return store(resetPending, userId, email);
}

export function consumeResetPending(token: string): PendingEntry | null {
  return consume(resetPending, token);
}

/* ---- test hook ----------------------------------------------------- */

export function __resetOpaquePendingStates(): void {
  changePasswordPending.clear();
  resetPending.clear();
}

/* ---- periodic sweep ------------------------------------------------ */

const sweep = setInterval(() => {
  const now = Date.now();
  for (const map of [changePasswordPending, resetPending]) {
    for (const [token, entry] of map) {
      if (entry.expiresAt < now) map.delete(token);
    }
  }
}, 60_000);
sweep.unref?.();
