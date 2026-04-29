import type { SecurityMode } from '@nodea/shared';

/** Short FR label for a security mode, displayed in the
 *  « Mode de sécurité » row's descriptor under the Security tab.
 *
 *  - `password_or_passkey` → « Standard »
 *  - `always_totp` → « TOTP requis »
 *  - anything else (currently `password_and_passkey`) → « Maximum »
 *
 *  Pure : no I/O, no React. Sat in `index.tsx` until the Account
 *  refacto extracted it here so the label is testable in isolation. */
export function modeLabel(mode: SecurityMode): string {
  if (mode === 'password_or_passkey') return 'Standard';
  if (mode === 'always_totp') return 'TOTP requis';
  return 'Maximum';
}
