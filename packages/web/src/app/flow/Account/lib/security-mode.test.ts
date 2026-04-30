import { describe, expect, it } from 'vitest';

import { modeLabelKey } from './security-mode';

describe('modeLabelKey', () => {
  it('maps password_or_passkey to "standard"', () => {
    expect(modeLabelKey('password_or_passkey')).toBe('standard');
  });

  it('maps always_totp to "totpRequired"', () => {
    expect(modeLabelKey('always_totp')).toBe('totpRequired');
  });

  it('falls back to "maximum" for any other mode', () => {
    expect(modeLabelKey('maximum')).toBe('maximum');
  });
});
