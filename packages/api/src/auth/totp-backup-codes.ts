/**
 * TOTP backup codes (Auth-Roadmap Phase 5, Auth-Spec §8.1 + §8.3).
 *
 * Generated at TOTP enrollment + on-demand regenerate. Each code
 * carries 120 bits of entropy (well above brute-forceable) so the
 * server stores them as SHA-256 hashes without per-code salts —
 * matching the recovery-code KEK approach in `bip39.ts` /
 * `auth-recovery.ts`.
 *
 * Format: 24 base32 chars = 120 bits, displayed grouped as
 * `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` for transcription. The hyphens
 * are cosmetic — `normaliseBackupCode` strips them before hashing /
 * comparison so the user can paste with or without them.
 *
 * Why 120 / 24 instead of the more usual 130 / 26 ? Six groups of
 * four chars read cleaner than five-of-four-plus-one-of-six (or any
 * unbalanced tail). 120 bits is comfortably uncrackable offline
 * (2^120 ≫ universe-age × every-CPU-on-earth), so the trade-off is
 * pure ergonomics.
 *
 * Single-use: at consumption, the route flips `used_at = now()` and
 * the row stays for audit. `mfa_totp_recovery_codes` already has a
 * `used_at` nullable column for that.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Base32 alphabet (RFC 4648, no padding) — same as TOTP secrets. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** 120 bits / 5 = 24 base32 chars. */
export const BACKUP_CODE_LENGTH_CHARS = 24;
export const BACKUP_CODES_PER_USER = 10;

/**
 * Generate one backup code: 120 bits of randomness encoded as 24
 * base32 chars, grouped `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` for
 * display.
 *
 * Hyphens are inserted only at display time. The hash is computed
 * over the de-hyphenated, uppercase form (`normaliseBackupCode`).
 */
export function generateBackupCode(): string {
  // 15 bytes = 120 bits = 24 base32 chars exactly, no truncation.
  const raw = randomBytes(15);
  let bits = '';
  for (const b of raw) {
    bits += b.toString(2).padStart(8, '0');
  }

  let chars = '';
  for (let i = 0; i < bits.length; i += 5) {
    const slice = bits.slice(i, i + 5);
    chars += BASE32_ALPHABET[parseInt(slice, 2)];
  }

  // Format: 4-4-4-4-4-4 = 24 chars + 5 hyphens = 29 visible chars.
  return [
    chars.slice(0, 4),
    chars.slice(4, 8),
    chars.slice(8, 12),
    chars.slice(12, 16),
    chars.slice(16, 20),
    chars.slice(20, 24),
  ].join('-');
}

/**
 * Generate a fresh batch of {@link BACKUP_CODES_PER_USER} backup
 * codes. Returned in the order they should be displayed to the user;
 * persistence order is irrelevant since we look up by hash.
 */
export function generateBackupCodes(): string[] {
  const codes = new Array<string>(BACKUP_CODES_PER_USER);
  for (let i = 0; i < BACKUP_CODES_PER_USER; i++) {
    codes[i] = generateBackupCode();
  }
  return codes;
}

/**
 * Normalise a user-typed backup code: strip non-alphanumerics,
 * uppercase. Tolerates spaces, hyphens, lowercase. Returns `null`
 * when the result doesn't match the expected length / alphabet —
 * the caller treats `null` as a guaranteed mismatch.
 */
export function normaliseBackupCode(input: string): string | null {
  const stripped = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (stripped.length !== BACKUP_CODE_LENGTH_CHARS) return null;
  for (const c of stripped) {
    if (!BASE32_ALPHABET.includes(c)) return null;
  }
  return stripped;
}

/** Hash a normalised backup code for storage / lookup. */
export function hashBackupCode(normalised: string): string {
  return createHash('sha256').update(normalised, 'utf-8').digest('hex');
}

/**
 * Constant-time equality on two SHA-256 hex strings. Wraps Node's
 * `timingSafeEqual` after a strict format check (lower-case hex,
 * 64 chars) — `Buffer.from('zz', 'hex')` returns an empty buffer
 * silently rather than throwing, which would otherwise let two
 * malformed inputs compare equal under `timingSafeEqual`.
 */
const HEX_64 = /^[0-9a-f]{64}$/;
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  if (!HEX_64.test(a) || !HEX_64.test(b)) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
