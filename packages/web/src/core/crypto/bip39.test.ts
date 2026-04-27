import { describe, it, expect } from 'vitest';
import {
  BIP39_ENTROPY_BYTES,
  RECOVERY_CODE_WORDS,
  generateRecoveryMnemonic,
  normaliseMnemonic,
  recoveryMnemonicToEntropy,
  sha256Hex,
  splitMnemonicForDisplay,
} from './bip39.ts';

describe('BIP39 recovery code helpers', () => {
  it('generates a 12-word mnemonic with 16 bytes of entropy', () => {
    const { mnemonic, entropy } = generateRecoveryMnemonic();
    expect(mnemonic.split(' ')).toHaveLength(RECOVERY_CODE_WORDS);
    expect(entropy).toBeInstanceOf(Uint8Array);
    expect(entropy.length).toBe(BIP39_ENTROPY_BYTES);
  });

  it('round-trips: generated mnemonic re-decodes to the same entropy', () => {
    const { mnemonic, entropy } = generateRecoveryMnemonic();
    const decoded = recoveryMnemonicToEntropy(mnemonic);
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded!)).toEqual(Array.from(entropy));
  });

  it('returns null on the wrong word count', () => {
    expect(recoveryMnemonicToEntropy('only three words here')).toBeNull();
    // 13 words — wrong count even if every word is valid BIP39.
    const { mnemonic } = generateRecoveryMnemonic();
    expect(recoveryMnemonicToEntropy(mnemonic + ' extra')).toBeNull();
  });

  it('returns null on an unknown word (not in the wordlist)', () => {
    const { mnemonic } = generateRecoveryMnemonic();
    const tampered = mnemonic.replace(/^\S+/, 'zzzzzzz');
    expect(recoveryMnemonicToEntropy(tampered)).toBeNull();
  });

  it('returns null on a bad checksum (typo in last word)', () => {
    const { mnemonic } = generateRecoveryMnemonic();
    // Replace the last word with another valid BIP39 word that
    // (almost certainly) breaks the 4-bit checksum.
    const words = mnemonic.split(' ');
    words[words.length - 1] = words[0]!;
    const tampered = words.join(' ');
    // Could occasionally pass if word[0] === word[-1] — pick a
    // different replacement in that pathological case.
    if (tampered === mnemonic) return;
    expect(recoveryMnemonicToEntropy(tampered)).toBeNull();
  });

  it('normalises whitespace + casing on input', () => {
    const { mnemonic } = generateRecoveryMnemonic();
    const ugly = `  ${mnemonic.toUpperCase().replace(/ /g, '\n  ')}  `;
    const decoded = recoveryMnemonicToEntropy(ugly);
    expect(decoded).not.toBeNull();
  });

  it('produces independent entropy on each generation (non-deterministic)', () => {
    const a = generateRecoveryMnemonic();
    const b = generateRecoveryMnemonic();
    expect(a.mnemonic).not.toBe(b.mnemonic);
  });
});

describe('normaliseMnemonic', () => {
  it('collapses whitespace runs to single spaces and lowercases', () => {
    expect(normaliseMnemonic('  Foo   Bar\nBaz  ')).toBe('foo bar baz');
  });
});

describe('splitMnemonicForDisplay', () => {
  it('chunks the 12 words into 4 rows of 3', () => {
    const { mnemonic } = generateRecoveryMnemonic();
    const rows = splitMnemonicForDisplay(mnemonic);
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toHaveLength(3);
    expect(rows.flat()).toEqual(mnemonic.split(' '));
  });
});

describe('sha256Hex', () => {
  it('returns 64 lowercase hex chars', async () => {
    const out = await sha256Hex(new Uint8Array([1, 2, 3]));
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the canonical SHA-256 of "abc"', async () => {
    // Reference: NIST FIPS 180-4 example.
    const bytes = new TextEncoder().encode('abc');
    const out = await sha256Hex(bytes);
    expect(out).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic on the same input', async () => {
    const a = await sha256Hex(new Uint8Array([42, 42, 42]));
    const b = await sha256Hex(new Uint8Array([42, 42, 42]));
    expect(a).toBe(b);
  });
});
