import type { SecurityMode } from '@nodea/shared';

export type ModeLabelKey = 'standard' | 'twoFactor' | 'maximum';

/** Map a security mode to its label key under
 *  `account.security.mode.labels.*`. The actual translation
 *  happens at the call site via `t('account.security.mode.labels.<key>')` —
 *  this helper stays pure (no React, no provider) so it remains
 *  testable in isolation.
 *
 *  - `password_or_passkey` → `'standard'`
 *  - `always_2fa` → `'twoFactor'` (since #72 a passkey or TOTP works,
 *     so the label can't say "TOTP requis" anymore)
 *  - anything else (currently `maximum`) → `'maximum'` */
export function modeLabelKey(mode: SecurityMode): ModeLabelKey {
  if (mode === 'password_or_passkey') return 'standard';
  if (mode === 'always_2fa') return 'twoFactor';
  return 'maximum';
}
