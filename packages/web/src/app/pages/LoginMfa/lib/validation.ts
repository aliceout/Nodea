/**
 * Pure helpers shared between the TOTP code form and the backup
 * code form on the LoginMfa page. Server side accepts either
 * shape on the same endpoint and disambiguates by length —
 * keeping the rules in one file means front + future tests stay
 * consistent with what the server expects.
 */

/** Strip non-digits and clip to 6 characters. The TOTP form's
 *  `<Field>` uses `inputMode="numeric"` to nudge the keyboard,
 *  but real keyboards still let `'1 2 3 4 5 6'` or
 *  `'123-456'` through ; this is the front-end normaliser
 *  applied on every keystroke. */
export function sanitizeTotpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** True when `raw` is a 6-digit TOTP code (after trimming).
 *  Drives the « Vérifier » button's disabled state in the
 *  `code` sub-mode. */
export function isValidTotpCode(raw: string): boolean {
  return /^\d{6}$/.test(raw.trim());
}

/** True when `raw` looks like a 24-character single-use backup
 *  code. The server accepts hyphens for readability ; we strip
 *  every non-alnum before counting so `1234-5678-…` of length 29
 *  passes as cleanly as `12345678…` of length 24. */
export function isValidBackupCode(raw: string): boolean {
  return raw.replace(/[^A-Za-z0-9]/g, '').length >= 24;
}
