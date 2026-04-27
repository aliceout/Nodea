/**
 * TOTP primitives (Auth-Roadmap Phase 5, Auth-Spec §8).
 *
 * Thin wrappers around `otplib@13.4.0` with the Nodea-specific
 * defaults baked in:
 *
 *   - SHA1 / 6 digits / 30s period (RFC 6238, universally compatible
 *     with Google Auth, Authy, Bitwarden, Ente Auth…).
 *   - 20-byte secret (`length: 20` → 160 bits, RFC-recommended floor).
 *   - Verification window skew ±1 (30s before / 30s after) — matches
 *     the typical clock drift seen in the wild without weakening
 *     security.
 *
 * Anti-replay (`last_window`) is enforced by the caller, not here:
 * `verifyCode` returns the matched window so the route handler can
 * refuse any window ≤ stored. Keeping the anti-replay check at the
 * route layer means we don't have to thread DB access through this
 * helper.
 */
import { generateSecret, generateURI, verify } from 'otplib';

/** RFC 6238 standard parameters — must NOT change without a migration.
 *  `TOTP_ALGO` is the otplib spelling (lowercase, no hyphen); the
 *  authenticator-facing URI param is `SHA1` (`buildTotpUri` handles
 *  the translation via the `algorithm` field). */
export const TOTP_ALGO = 'sha1' as const;
export const TOTP_DIGITS = 6 as const;
export const TOTP_PERIOD_SECONDS = 30 as const;
export const TOTP_SECRET_BYTES = 20 as const;
export const TOTP_SKEW_WINDOWS = 1 as const;

/**
 * Generate a fresh 20-byte TOTP secret, base32-encoded for easy
 * transcription / authenticator app input.
 */
export function generateTotpSecret(): string {
  return generateSecret({ length: TOTP_SECRET_BYTES });
}

/**
 * Build the `otpauth://totp/...` URI for QR-code rendering. The
 * label is intentionally minimal — `"Nodea"` only, no email or
 * user_id (Auth-Spec §8.2): screenshots of authenticator apps
 * leak less than a per-user identifier would.
 *
 * Trade-off documented: an user.ice with multiple Nodea accounts
 * in the same authenticator won't be able to distinguish entries
 * by label alone — they have to rename them manually post-import.
 */
export function buildTotpUri(secretBase32: string): string {
  return generateURI({
    strategy: 'totp',
    issuer: 'Nodea',
    label: 'Nodea',
    secret: secretBase32,
    algorithm: TOTP_ALGO,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });
}

/**
 * Compute the current TOTP window (= floor(now / period)). Used by
 * `verifyCode` consumers to bump `mfa_totp.last_window` on success
 * and refuse replays of the same window.
 */
export function currentWindow(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

export interface VerifyTotpOk {
  valid: true;
  /** Window the code matched against (current ± skew). The caller
   *  stores this in `mfa_totp.last_window` to refuse the same
   *  window from being replayed (Auth-Spec §8.3). */
  window: number;
}

export interface VerifyTotpFail {
  valid: false;
}

/**
 * Verify a TOTP code against the secret with the standard ±1 window
 * skew. Constant-time comparison is handled by `otplib.verify`.
 *
 * Returns the matched window when valid so the caller can enforce
 * `lastWindow` anti-replay (refuse `matched <= stored`).
 */
export async function verifyTotpCode(
  secretBase32: string,
  code: string,
  now: Date = new Date(),
): Promise<VerifyTotpOk | VerifyTotpFail> {
  // otplib v13 takes `epoch` in **seconds** (Unix), not milliseconds,
  // and `epochTolerance` in **seconds** — its internal counter range
  // is `[(epoch - past) / period, (epoch + future) / period]`. To
  // express ±N windows we pass `epochTolerance = N * period`.
  const epochSeconds = Math.floor(now.getTime() / 1000);
  const result = await verify({
    strategy: 'totp',
    secret: secretBase32,
    token: code,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    algorithm: TOTP_ALGO,
    epochTolerance: TOTP_SKEW_WINDOWS * TOTP_PERIOD_SECONDS,
    epoch: epochSeconds,
  });
  if (!result.valid) return { valid: false };
  // `delta` is the offset in windows (0 = current, -1 = previous,
  // +1 = next). We reconstruct the absolute matched window so the
  // anti-replay check has something monotonic to compare against.
  const delta = typeof result.delta === 'number' ? result.delta : 0;
  return { valid: true, window: currentWindow(now) + delta };
}
