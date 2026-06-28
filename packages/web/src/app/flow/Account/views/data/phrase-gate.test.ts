import { describe, it, expect } from 'vitest';

import { isBackupPhraseConfirmed } from './phrase-gate';

describe('isBackupPhraseConfirmed', () => {
  it('stays closed until the phrase is confirmed', () => {
    // Never confirmed — version defaults to 1, confirmed is absent.
    expect(isBackupPhraseConfirmed({})).toBe(false);
    expect(isBackupPhraseConfirmed({ backupPhraseVersion: 1 })).toBe(false);
  });

  it('opens once the confirmed version matches the current one', () => {
    // Both sides default to 1.
    expect(isBackupPhraseConfirmed({ backupPhraseConfirmedVersion: 1 })).toBe(true);
    expect(
      isBackupPhraseConfirmed({
        backupPhraseVersion: 2,
        backupPhraseConfirmedVersion: 2,
      }),
    ).toBe(true);
  });

  it('re-closes after a rotation bumps the version ahead of the confirmation', () => {
    expect(
      isBackupPhraseConfirmed({
        backupPhraseVersion: 2,
        backupPhraseConfirmedVersion: 1,
      }),
    ).toBe(false);
  });
});
