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
    const words = mnemonic.split(' ');
    // The BIP39 checksum is 4 bits → only 16 possible values, so a
    // single-word substitution has ~1/16 chance of accidentally
    // landing on a still-valid mnemonic. Try up to 12 distinct
    // replacements (one for each existing word position) until we
    // hit a substitution that genuinely invalidates the checksum.
    // Probability of all 12 attempts being lucky-valid is (1/16)^12,
    // i.e. round-zero — the test is now deterministic in practice.
    let tampered = mnemonic;
    for (let i = 0; i < words.length; i += 1) {
      const candidate = [...words];
      candidate[candidate.length - 1] = words[i]!;
      const next = candidate.join(' ');
      if (next === mnemonic) continue; // word[i] === word[-1], skip
      if (recoveryMnemonicToEntropy(next) === null) {
        tampered = next;
        break;
      }
    }
    expect(tampered).not.toBe(mnemonic);
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
  it('treats hyphens as separators (and trims leading/trailing ones)', () => {
    expect(normaliseMnemonic('Word1-Word2 - word3')).toBe('word1 word2 word3');
    expect(normaliseMnemonic('-abandon-ability-')).toBe('abandon ability');
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
