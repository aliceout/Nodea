import { describe, it, expect } from 'vitest';
import { deriveMainKeys, wipeRawBytes } from './key-material.ts';
import { encryptAESGCM, decryptAESGCM } from './aes.ts';
import { HKDF_LABEL_AES, HKDF_LABEL_HMAC, hkdfDeriveBits } from './hkdf.ts';
import { hmacSha256 } from './hmac.ts';
import { randomBytes } from './base64.ts';

/**
 * Test-local re-derivation of the raw sub-key bytes — lives HERE
 * (audit 2026-06), not in `key-material.ts` : a production-importable
 * « give me the sub-key bytes in clear » helper was an unnecessary
 * surface, even as a pure function. The derivation is reproducible
 * from the exported `hkdfDeriveBits` + labels.
 */
async function deriveRawSubkeys(
  rawBytes: Uint8Array,
): Promise<{ aesBytes: Uint8Array; hmacBytes: Uint8Array }> {
  const [aesBytes, hmacBytes] = await Promise.all([
    hkdfDeriveBits(rawBytes, HKDF_LABEL_AES, 32),
    hkdfDeriveBits(rawBytes, HKDF_LABEL_HMAC, 32),
  ]);
  return { aesBytes, hmacBytes };
}

describe('deriveMainKeys — HKDF domain separation', () => {
  it('produces AES and HMAC sub-keys that are byte-level distinct', async () => {
    const raw = randomBytes(32);
    const { aesBytes, hmacBytes } = await deriveRawSubkeys(raw);
    expect(aesBytes).toHaveLength(32);
    expect(hmacBytes).toHaveLength(32);
    expect(Array.from(aesBytes)).not.toEqual(Array.from(hmacBytes));
  });

  it('is deterministic for the same input', async () => {
    const raw = new Uint8Array(32).fill(7);
    const a = await deriveRawSubkeys(raw);
    const b = await deriveRawSubkeys(raw);
    expect(Array.from(a.aesBytes)).toEqual(Array.from(b.aesBytes));
    expect(Array.from(a.hmacBytes)).toEqual(Array.from(b.hmacBytes));
  });

  it('rejects a main key of the wrong length', async () => {
    await expect(deriveMainKeys(new Uint8Array(31))).rejects.toThrow();
    await expect(deriveMainKeys(new Uint8Array(33))).rejects.toThrow();
  });

  it('returns CryptoKey handles usable for encrypt and sign', async () => {
    const raw = randomBytes(32);
    const { aesKey, hmacKey } = await deriveMainKeys(raw);

    const blob = await encryptAESGCM('hello world', aesKey);
    const plain = await decryptAESGCM(blob, aesKey);
    expect(plain).toBe('hello world');

    const tag = await hmacSha256(hmacKey, 'hello world');
    expect(tag).toHaveLength(32);
  });

  it('AES sub-key cannot be used as HMAC, and vice versa (compile + runtime)', async () => {
    const raw = randomBytes(32);
    const { aesKey, hmacKey } = await deriveMainKeys(raw);

    // Runtime sanity: the imported key algorithms are distinct.
    expect(aesKey.algorithm.name).toBe('AES-GCM');
    expect(hmacKey.algorithm.name).toBe('HMAC');

    // Passing the wrong key raises a WebCrypto InvalidAccessError/NotSupportedError.
    // @ts-expect-error — intentional misuse to prove runtime rejection.
    await expect(encryptAESGCM('x', hmacKey)).rejects.toBeDefined();
  });
});

describe('wipeRawBytes', () => {
  it('zeroes the buffer in place', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    wipeRawBytes(bytes);
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0, 0]);
  });

  it('tolerates null/undefined/empty without throwing', () => {
    expect(() => wipeRawBytes(null)).not.toThrow();
    expect(() => wipeRawBytes(undefined)).not.toThrow();
    expect(() => wipeRawBytes(new Uint8Array(0))).not.toThrow();
  });
});
