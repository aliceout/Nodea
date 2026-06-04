/**
 * Per-process holder for the OPAQUE `serverLoginState` between
 * `/auth/login/start` and `/auth/login/finish` (Auth-Roadmap Phase
 * 2C).
 *
 * The OPAQUE login protocol runs in two HTTP round-trips. The
 * server's intermediate state is opaque to us (an internal blob
 * from `@serenity-kit/opaque`) but it has to survive between the
 * two calls. V1 ships single-instance so an in-memory map is fine;
 * a future multi-instance deployment would back this onto Redis or
 * encode the state into a signed cookie.
 *
 * The map keys (`loginToken`) are 32 random bytes encoded as
 * base64url — 256 bits of entropy is far beyond any brute-force
 * window. State is single-use: consuming a token deletes the
 * entry. A 5-minute TTL covers slow networks without keeping
 * abandoned sessions around forever.
 */
import { randomBytes } from 'node:crypto';

const TTL_MS = 5 * 60 * 1000;

interface PendingState {
  state: string;
  /** Identifier passed to `server.startLogin` — re-checked at finish
   *  so the client can't swap identifiers between the two calls. */
  userIdentifier: string;
  expiresAt: number;
}

const pending = new Map<string, PendingState>();

// DEBUG (Vitest 4 migration) : unique id per module instance, lets the
// trace lines below tell « stored in module A but consumed from module B »
// apart from « token genuinely never stored ». Remove once the CI test
// pattern is restored.
const MODULE_ID = randomBytes(4).toString('hex');

/**
 * Store a fresh `serverLoginState` and return the opaque token the
 * client echoes back at `/finish`. Caller owns the rate-limit on
 * /start; this layer just keys the map.
 */
export function storeLoginState(
  state: string,
  userIdentifier: string,
): string {
  const token = randomBytes(32).toString('base64url');
  pending.set(token, {
    state,
    userIdentifier,
    expiresAt: Date.now() + TTL_MS,
  });
  console.warn(
    `[opaque-login-state DEBUG] store mod=${MODULE_ID} token=${token.slice(0, 8)}… size=${pending.size}`,
  );
  return token;
}

/**
 * Look up + delete the pending state for `token`. Returns `null`
 * when the token is unknown, expired, or already consumed — every
 * caller treats those the same way (login failure with a generic
 * error, no client-visible distinction).
 */
export function consumeLoginState(token: string): PendingState | null {
  const entry = pending.get(token);
  console.warn(
    `[opaque-login-state DEBUG] consume mod=${MODULE_ID} token=${token.slice(0, 8)}… size=${pending.size} hit=${entry !== undefined}`,
  );
  if (!entry) return null;
  pending.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

/**
 * Test hook — clears the in-memory state between Vitest cases so
 * one test's leftover tokens don't leak into another.
 */
export function __resetLoginStates(): void {
  pending.clear();
}

/**
 * Periodic sweep so abandoned tokens don't pile up over a long-
 * running process. `unref()` keeps the timer from blocking the
 * event loop on shutdown — we don't care if a sweep tick gets
 * skipped during graceful exit.
 */
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(token);
  }
}, 60_000);
sweep.unref?.();
