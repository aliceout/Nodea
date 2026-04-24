import { describe, it, expect } from 'vitest';
import {
  base64ToBase64Url,
  base64ToBytes,
  base64UrlToBase64,
  base64UrlToBytes,
  bytesToBase64,
  bytesToBase64Url,
  randomBytes,
} from './base64.ts';
import type { Base64, Base64Url } from '@nodea/shared/crypto-types';

describe('base64 / base64url round-trips', () => {
  const samples: Uint8Array[] = [
    new Uint8Array(0),
    new Uint8Array([0]),
    new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]),
    new Uint8Array(1024).map((_, i) => i & 0xff),
  ];

  it.each(samples.map((s, i) => [i, s] as const))(
    'bytes → base64 → bytes is identity (sample %i)',
    (_, bytes) => {
      const b64 = bytesToBase64(bytes);
      const back = base64ToBytes(b64);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    },
  );

  it.each(samples.map((s, i) => [i, s] as const))(
    'bytes → base64url → bytes is identity (sample %i)',
    (_, bytes) => {
      const b64u = bytesToBase64Url(bytes);
      expect(b64u).not.toMatch(/[+/=]/);
      const back = base64UrlToBytes(b64u);
      expect(Array.from(back)).toEqual(Array.from(bytes));
    },
  );

  it('base64 → base64url → base64 preserves the original', () => {
    const bytes = new Uint8Array([0xff, 0x00, 0x7f, 0x80, 0x3e, 0x3f]);
    const b64 = bytesToBase64(bytes);
    const b64u = base64ToBase64Url(b64);
    const back = base64UrlToBase64(b64u);
    expect(back).toBe(b64);
  });

  it('randomBytes returns the requested length and is not constant', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('randomBytes rejects invalid lengths', () => {
    expect(() => randomBytes(-1)).toThrow();
    expect(() => randomBytes(1.5)).toThrow();
    expect(() => randomBytes(70_000)).toThrow();
  });

  it('respects branded types at compile time (smoke test of the type contract)', () => {
    const b64: Base64 = bytesToBase64(new Uint8Array([1, 2, 3]));
    const b64u: Base64Url = base64ToBase64Url(b64);
    // TypeScript alone enforces separation; this is a runtime smoke check.
    expect(typeof b64).toBe('string');
    expect(typeof b64u).toBe('string');
  });
});
