/**
 * Unit tests for TOTP primitives + backup codes (Auth-Roadmap
 * Phase 5A, Auth-Spec §8).
 *
 * These tests don't touch the DB — they exercise the wrapper logic
 * around `otplib` and the backup-code helpers in pure-JS. The full
 * route integration suite lives in `auth-totp.test.ts` (Phase 5B+).
 */
import { describe, it, expect } from 'vitest';
import { generate as otplibGenerate } from 'otplib';
import {
  TOTP_ALGO,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  buildTotpUri,
  currentWindow,
  generateTotpSecret,
  verifyTotpCode,
} from '../auth/totp.ts';
import {
  BACKUP_CODES_PER_USER,
  BACKUP_CODE_LENGTH_CHARS,
  constantTimeEqualHex,
  generateBackupCode,
  generateBackupCodes,
  hashBackupCode,
  normaliseBackupCode,
} from '../auth/totp-backup-codes.ts';

/* ============================================================================
 * TOTP secret + URI
 * ========================================================================== */

describe('totp — generateTotpSecret', () => {
  it('emits a 32-char base32 string (20 bytes × 8 bits / 5 = 32 chars)', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    // 20 raw bytes → 32 base32 chars (no padding for length 20).
    expect(secret.length).toBe(32);
  });

  it('produces fresh entropy on each call', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe('totp — buildTotpUri', () => {
  it('produces an otpauth://totp/Nodea URI with the secret + Nodea label only', () => {
    const uri = buildTotpUri('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    // Anti-fuite : label = "Nodea" only, no email or user_id (Auth-Spec §8.2).
    expect(uri).toContain('Nodea');
    expect(uri).not.toMatch(/@/);
    // otplib v13 omits algorithm/digits/period when they match RFC defaults.
    // Either the URI declares them OR it relies on defaults — both are
    // spec-compliant and importable by every authenticator we care about.
  });
});

/* ============================================================================
 * TOTP verification with skew + anti-replay
 * ========================================================================== */

describe('totp — verifyTotpCode', () => {
  // 32-char base32 = 20 bytes = 160 bits — matches generateTotpSecret()
  // and clears otplib v13's 128-bit minimum.
  const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  it('accepts the current-window code', async () => {
    const now = new Date();
    const code = await otplibGenerate({
      strategy: 'totp',
      secret: SECRET,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGO,
      epoch: Math.floor(now.getTime() / 1000),
    });
    const result = await verifyTotpCode(SECRET, code, now);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.window).toBe(currentWindow(now));
    }
  });

  it('accepts the previous-window code (skew −30s)', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - TOTP_PERIOD_SECONDS * 1000);
    const code = await otplibGenerate({
      strategy: 'totp',
      secret: SECRET,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGO,
      epoch: Math.floor(past.getTime() / 1000),
    });
    const result = await verifyTotpCode(SECRET, code, now);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.window).toBe(currentWindow(now) - 1);
    }
  });

  it('accepts the next-window code (skew +30s)', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + TOTP_PERIOD_SECONDS * 1000);
    const code = await otplibGenerate({
      strategy: 'totp',
      secret: SECRET,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGO,
      epoch: Math.floor(future.getTime() / 1000),
    });
    const result = await verifyTotpCode(SECRET, code, now);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.window).toBe(currentWindow(now) + 1);
    }
  });

  it('rejects a code from a window two steps away', async () => {
    const now = new Date();
    const farPast = new Date(now.getTime() - 2 * TOTP_PERIOD_SECONDS * 1000);
    const code = await otplibGenerate({
      strategy: 'totp',
      secret: SECRET,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: TOTP_ALGO,
      epoch: Math.floor(farPast.getTime() / 1000),
    });
    const result = await verifyTotpCode(SECRET, code, now);
    expect(result.valid).toBe(false);
  });

  it('rejects a 6-digit code that doesn\'t match', async () => {
    const result = await verifyTotpCode(SECRET, '000000');
    // Either falsy or .valid === false — both mean "no".
    expect(result.valid).toBe(false);
  });
});

/* ============================================================================
 * Backup codes
 * ========================================================================== */

describe('backup-codes — generateBackupCode', () => {
  it('emits a 24-char base32 string with 4-4-4-4-4-4 hyphenation', () => {
    const code = generateBackupCode();
    const stripped = code.replace(/-/g, '');
    expect(stripped.length).toBe(BACKUP_CODE_LENGTH_CHARS);
    expect(stripped).toMatch(/^[A-Z2-7]{24}$/);
    expect(code).toMatch(
      /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/,
    );
  });

  it('produces fresh entropy per call', () => {
    const a = generateBackupCode();
    const b = generateBackupCode();
    expect(a).not.toBe(b);
  });
});

describe('backup-codes — generateBackupCodes', () => {
  it(`emits exactly ${BACKUP_CODES_PER_USER} codes`, () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(BACKUP_CODES_PER_USER);
  });

  it('all codes in a batch are distinct', () => {
    const codes = generateBackupCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('backup-codes — normaliseBackupCode', () => {
  it('strips hyphens + spaces + uppercases', () => {
    expect(normaliseBackupCode('aaaa-bbbb-cccc-dddd-eeee-ffff')).toBe(
      'AAAABBBBCCCCDDDDEEEEFFFF',
    );
    expect(normaliseBackupCode('  AAAA bbbb-CCCC dddd EEEE ffff  ')).toBe(
      'AAAABBBBCCCCDDDDEEEEFFFF',
    );
  });

  it('returns null for the wrong length', () => {
    expect(normaliseBackupCode('AAAA')).toBeNull();
    expect(normaliseBackupCode('A'.repeat(25))).toBeNull();
  });

  it('returns null when a non-base32 char survives normalisation', () => {
    // 24-char string but contains '1' (not in RFC 4648 base32 alphabet).
    expect(normaliseBackupCode('1' + 'A'.repeat(23))).toBeNull();
  });

  it('round-trip with the displayed format', () => {
    const code = generateBackupCode();
    const normalised = normaliseBackupCode(code);
    expect(normalised).not.toBeNull();
    if (normalised) {
      expect(normalised).toBe(code.replace(/-/g, ''));
    }
  });
});

describe('backup-codes — hashBackupCode', () => {
  it('produces a stable 64-char hex digest', () => {
    const code = generateBackupCode();
    const normalised = normaliseBackupCode(code);
    expect(normalised).not.toBeNull();
    const h = hashBackupCode(normalised!);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashBackupCode(normalised!));
  });

  it('different codes hash to different digests', () => {
    const a = hashBackupCode('AAAABBBBCCCCDDDDEEEEFFFF');
    const b = hashBackupCode('AAAABBBBCCCCDDDDEEEEFFFG');
    expect(a).not.toBe(b);
  });
});

describe('backup-codes — constantTimeEqualHex', () => {
  it('returns true for equal hex strings', () => {
    const h = hashBackupCode('AAAABBBBCCCCDDDDEEEEFFFF');
    expect(constantTimeEqualHex(h, h)).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeEqualHex('aa', 'aaaa')).toBe(false);
  });

  it('returns false for non-equal strings', () => {
    const a = hashBackupCode('AAAABBBBCCCCDDDDEEEEFFFF');
    const b = hashBackupCode('AAAABBBBCCCCDDDDEEEEFFFG');
    expect(constantTimeEqualHex(a, b)).toBe(false);
  });

  it('returns false on malformed hex (not a hard error)', () => {
    // Pad to 64 chars so the length check doesn't bail first; the
    // hex regex still rejects 'z' as a non-hex char.
    expect(constantTimeEqualHex('z'.repeat(64), 'z'.repeat(64))).toBe(false);
  });
});
