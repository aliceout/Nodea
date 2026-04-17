import { describe, it, expect } from 'vitest';
import { encryptAESGCM, decryptAESGCM } from './aes.ts';
import { deriveMainKeys } from './key-material.ts';
import { randomBytes } from './base64.ts';

async function freshAesKey() {
  const { aesKey } = await deriveMainKeys(randomBytes(32));
  return aesKey;
}

describe('AES-GCM round-trip', () => {
  const plaintexts = [
    '',
    'hello',
    'accents éàçü',
    '🔑🧪🔒',
    'a'.repeat(10_000),
  ];

  it.each(plaintexts.map((p, i) => [i, p] as const))(
    'encrypt → decrypt is identity (sample %i)',
    async (_, plain) => {
      const key = await freshAesKey();
      const blob = await encryptAESGCM(plain, key);
      const back = await decryptAESGCM(blob, key);
      expect(back).toBe(plain);
    },
  );

  it('produces a different IV for each call (non-deterministic)', async () => {
    const key = await freshAesKey();
    const a = await encryptAESGCM('same', key);
    const b = await encryptAESGCM('same', key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('rejects a tampered ciphertext', async () => {
    const key = await freshAesKey();
    const blob = await encryptAESGCM('hello', key);
    // Flip one character in the b64-encoded data.
    const tampered = {
      iv: blob.iv,
      data: (blob.data.startsWith('A') ? 'B' : 'A' + blob.data.slice(1)) as typeof blob.data,
    };
    await expect(decryptAESGCM(tampered, key)).rejects.toBeDefined();
  });

  it('rejects decryption with a different key', async () => {
    const blob = await encryptAESGCM('hello', await freshAesKey());
    await expect(decryptAESGCM(blob, await freshAesKey())).rejects.toBeDefined();
  });
});
