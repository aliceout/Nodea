import { describe, it, expect } from 'vitest';
import {
  parseEnvelope,
  serialiseEnvelope,
  unwrapMainKeyBytes,
  wrapMainKey,
} from './envelope.ts';
import { randomBytes } from './base64.ts';

describe('envelope serialisation', () => {
  it('round-trips "<iv>.<data>"', () => {
    const str = serialiseEnvelope({
      // @ts-expect-error branded runtime value, we're just checking format
      iv: 'AAAA',
      // @ts-expect-error
      data: 'BBBBCCCC',
    });
    expect(str).toBe('AAAA.BBBBCCCC');
    const back = parseEnvelope(str);
    expect(back.iv).toBe('AAAA');
    expect(back.data).toBe('BBBBCCCC');
  });

  it('throws on a malformed envelope (no dot separator)', () => {
    expect(() => parseEnvelope('no-dot-here')).toThrow();
  });
});

describe('wrap / unwrap main key under a password', () => {
  it('round-trips: the same password yields the original bytes', async () => {
    const raw = randomBytes(32);
    const original = new Uint8Array(raw); // keep a copy, wrap may mutate salt buffer elsewhere
    const { encryptionSalt, encryptedKey } = await wrapMainKey('correct-horse-battery-staple', raw);
    const back = await unwrapMainKeyBytes(
      'correct-horse-battery-staple',
      encryptionSalt,
      encryptedKey,
    );
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it('rejects a wrong password (AES-GCM auth tag fails)', async () => {
    const raw = randomBytes(32);
    const { encryptionSalt, encryptedKey } = await wrapMainKey('password-a', raw);
    await expect(
      unwrapMainKeyBytes('password-b', encryptionSalt, encryptedKey),
    ).rejects.toBeDefined();
  });

  it('different passwords produce different envelopes for the same key', async () => {
    const raw = randomBytes(32);
    const a = await wrapMainKey('pw-A', raw);
    const b = await wrapMainKey('pw-B', raw);
    expect(a.encryptedKey).not.toBe(b.encryptedKey);
    expect(a.encryptionSalt).not.toBe(b.encryptionSalt);
  });
}, { timeout: 20_000 });
