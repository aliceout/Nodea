import { describe, it, expect } from 'vitest';
import {
  PRF_INPUT_V1,
  credentialIdToB64Url,
  unwrapKekUnderPrf,
  wrapKekUnderPrf,
} from './passkey-prf.ts';
import { buildPasskeyAAD } from './factor-wrap.ts';
import { randomBytes } from './base64.ts';

describe('passkey-prf — PRF input constant', () => {
  it('is exactly 32 bytes', () => {
    expect(PRF_INPUT_V1.byteLength).toBe(32);
  });

  it('starts with ASCII "nodea:prf-v1" then zero-padding', () => {
    const head = String.fromCharCode(...PRF_INPUT_V1.slice(0, 12));
    expect(head).toBe('nodea:prf-v1');
    for (let i = 12; i < 32; i++) {
      expect(PRF_INPUT_V1[i]).toBe(0);
    }
  });
});

describe('passkey-prf — credentialIdToB64Url', () => {
  it('round-trips through canonical base64url (no padding, URL-safe alphabet)', () => {
    // 0xFF / 0xFE chosen because they touch both URL-special characters
    // (`+` / `/` in standard base64) — the helper must emit `-` / `_`.
    const raw = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb]);
    const encoded = credentialIdToB64Url(raw);
    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });
});

describe('passkey-prf — wrap / unwrap KEK under PRF output', () => {
  const userId = '11111111-2222-3333-4444-555555555555';
  const credentialId = credentialIdToB64Url(randomBytes(64));

  it('round-trip wrap → unwrap', async () => {
    const kek = randomBytes(32);
    const prfOutput = randomBytes(32);

    const wrapped = await wrapKekUnderPrf(kek, prfOutput, userId, credentialId);
    const back = await unwrapKekUnderPrf(wrapped, prfOutput, userId, credentialId);

    expect(Array.from(back)).toEqual(Array.from(kek));
  });

  it('produces a fresh IV per wrap (non-deterministic)', async () => {
    const kek = randomBytes(32);
    const prfOutput = randomBytes(32);

    const a = await wrapKekUnderPrf(kek, prfOutput, userId, credentialId);
    const b = await wrapKekUnderPrf(kek, prfOutput, userId, credentialId);

    expect(a.wrappedKekIv).not.toBe(b.wrappedKekIv);
    expect(a.wrappedKek).not.toBe(b.wrappedKek);
  });

  it('rejects unwrap with a different PRF output', async () => {
    const kek = randomBytes(32);
    const prfA = randomBytes(32);
    const prfB = randomBytes(32);

    const wrapped = await wrapKekUnderPrf(kek, prfA, userId, credentialId);
    await expect(
      unwrapKekUnderPrf(wrapped, prfB, userId, credentialId),
    ).rejects.toBeDefined();
  });

  it('rejects unwrap when the credential id was swapped (cross-passkey AAD bind)', async () => {
    const kek = randomBytes(32);
    const prfOutput = randomBytes(32);
    const otherCredential = credentialIdToB64Url(randomBytes(64));

    const wrapped = await wrapKekUnderPrf(kek, prfOutput, userId, credentialId);
    await expect(
      unwrapKekUnderPrf(wrapped, prfOutput, userId, otherCredential),
    ).rejects.toBeDefined();
  });

  it('rejects unwrap when the user id was swapped (cross-account AAD bind)', async () => {
    const kek = randomBytes(32);
    const prfOutput = randomBytes(32);
    const otherUser = '99999999-aaaa-bbbb-cccc-dddddddddddd';

    const wrapped = await wrapKekUnderPrf(kek, prfOutput, userId, credentialId);
    await expect(
      unwrapKekUnderPrf(wrapped, prfOutput, otherUser, credentialId),
    ).rejects.toBeDefined();
  });
});

describe('passkey-prf — buildPasskeyAAD format', () => {
  it('joins userId + "passkey" + credentialId with US separator (\\x1f)', () => {
    const aad = buildPasskeyAAD('user-1', 'cred-2');
    expect(aad).toBe('nodea:v1\x1fuser-1\x1fpasskey\x1fcred-2');
  });
});
