import { describe, expect, it } from 'vitest';

import { modeLabelKey } from './security-mode';

describe('modeLabelKey', () => {
  it('maps password_or_passkey to "standard"', () => {
    expect(modeLabelKey('password_or_passkey')).toBe('standard');
  });

  it('maps always_2fa to "twoFactor" (since #72 TOTP or passkey both work)', () => {
    expect(modeLabelKey('always_2fa')).toBe('twoFactor');
  });

  it('falls back to "maximum" for any other mode', () => {
    expect(modeLabelKey('maximum')).toBe('maximum');
  });
});
