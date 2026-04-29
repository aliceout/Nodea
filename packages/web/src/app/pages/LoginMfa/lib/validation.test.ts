import { describe, expect, it } from 'vitest';

import {
  isValidBackupCode,
  isValidTotpCode,
  sanitizeTotpInput,
} from './validation';

describe('sanitizeTotpInput', () => {
  it('strips non-digits and clips to 6 chars', () => {
    expect(sanitizeTotpInput('123 456')).toBe('123456');
    expect(sanitizeTotpInput('123-456')).toBe('123456');
    expect(sanitizeTotpInput('1234567890')).toBe('123456');
    expect(sanitizeTotpInput('abc12def345gh6')).toBe('123456');
  });

  it('returns empty string when input has no digits', () => {
    expect(sanitizeTotpInput('abc')).toBe('');
    expect(sanitizeTotpInput('')).toBe('');
  });
});

describe('isValidTotpCode', () => {
  it('accepts exactly 6 digits, trimmed', () => {
    expect(isValidTotpCode('123456')).toBe(true);
    expect(isValidTotpCode('  123456  ')).toBe(true);
  });

  it('rejects too few or too many digits', () => {
    expect(isValidTotpCode('12345')).toBe(false);
    expect(isValidTotpCode('1234567')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidTotpCode('12345a')).toBe(false);
    expect(isValidTotpCode('123-456')).toBe(false);
  });
});

describe('isValidBackupCode', () => {
  it('accepts 24 alphanumerics, with or without separators', () => {
    expect(isValidBackupCode('A'.repeat(24))).toBe(true);
    expect(isValidBackupCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF')).toBe(true);
    expect(isValidBackupCode('  ' + 'A'.repeat(12) + '  ' + 'B'.repeat(12) + '  ')).toBe(true);
  });

  it('rejects fewer than 24 alphanumerics', () => {
    expect(isValidBackupCode('A'.repeat(23))).toBe(false);
    expect(isValidBackupCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFF')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isValidBackupCode('')).toBe(false);
    expect(isValidBackupCode('---')).toBe(false);
  });
});
