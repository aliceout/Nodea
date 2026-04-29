import { describe, expect, it } from 'vitest';

import { modeLabel } from './security-mode';

describe('modeLabel', () => {
  it('maps password_or_passkey to « Standard »', () => {
    expect(modeLabel('password_or_passkey')).toBe('Standard');
  });

  it('maps always_totp to « TOTP requis »', () => {
    expect(modeLabel('always_totp')).toBe('TOTP requis');
  });

  it('falls back to « Maximum » for any other mode', () => {
    expect(modeLabel('maximum')).toBe('Maximum');
  });
});
