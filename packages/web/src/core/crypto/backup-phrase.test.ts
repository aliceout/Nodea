import { describe, it, expect } from 'vitest';
import type { HmacMainKey } from '@nodea/shared/crypto-types';

import { deriveBackupPhrase } from './backup-phrase';
import { validateMnemonic, wordlist } from './bip39';

async function importHmacKey(seed: number): Promise<HmacMainKey> {
  const raw = new Uint8Array(32).fill(seed);
  return (await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )) as HmacMainKey;
}

describe('deriveBackupPhrase', () => {
  it('produces a valid 12-word BIP39 mnemonic', async () => {
    const key = await importHmacKey(1);
    const phrase = await deriveBackupPhrase(key, 1);
    expect(phrase.split(' ')).toHaveLength(12);
    expect(validateMnemonic(phrase, wordlist)).toBe(true);
  });

  it('is deterministic for the same key + version (stable across exports)', async () => {
    const key = await importHmacKey(7);
    const a = await deriveBackupPhrase(key, 1);
    const b = await deriveBackupPhrase(key, 1);
    expect(a).toBe(b);
  });

  it('changes when the version is bumped (rotation)', async () => {
    const key = await importHmacKey(7);
    const v1 = await deriveBackupPhrase(key, 1);
    const v2 = await deriveBackupPhrase(key, 2);
    expect(v1).not.toBe(v2);
  });

  it('differs between distinct keys (per-account)', async () => {
    const a = await deriveBackupPhrase(await importHmacKey(1), 1);
    const b = await deriveBackupPhrase(await importHmacKey(2), 1);
    expect(a).not.toBe(b);
  });
});
