import { describe, it, expect } from 'vitest';
import {
  buildKekAAD,
  buildMainKeyAAD,
  unwrapKekUnderFactor,
  unwrapMainKeyUnderKek,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from './factor-wrap.ts';
import { bytesToBase64Url, randomBytes } from './base64.ts';

describe('factor-wrap — KEK under factor (HKDF nodea:wrap-kek + AES-GCM)', () => {
  const userId = '11111111-2222-3333-4444-555555555555';

  it('round-trip wrap → unwrap with base64url IKM (OPAQUE export_key shape)', async () => {
    const kek = randomBytes(32);
    // `@serenity-kit/opaque` returns `exportKey` as base64url —
    // mirror that shape here so the test catches regressions if
    // someone ever swaps the asIkmBytes decoder back to hex.
    const exportKey = bytesToBase64Url(randomBytes(32));
    const aad = buildKekAAD(userId, 'password');

    const wrapped = await wrapKekUnderFactor(kek, exportKey, aad);
    const back = await unwrapKekUnderFactor(wrapped, exportKey, aad);

    expect(Array.from(back)).toEqual(Array.from(kek));
  });

  it('round-trip wrap → unwrap with bytes IKM (PRF / recovery shape)', async () => {
    const kek = randomBytes(32);
    const ikm = randomBytes(32);
    const aad = buildKekAAD(userId, 'recovery');

    const wrapped = await wrapKekUnderFactor(kek, ikm, aad);
    const back = await unwrapKekUnderFactor(wrapped, ikm, aad);

    expect(Array.from(back)).toEqual(Array.from(kek));
  });

  it('produces a fresh IV per wrap (non-deterministic)', async () => {
    const kek = randomBytes(32);
    const ikm = randomBytes(32);
    const aad = buildKekAAD(userId, 'password');

    const a = await wrapKekUnderFactor(kek, ikm, aad);
    const b = await wrapKekUnderFactor(kek, ikm, aad);

    expect(a.wrappedKekIv).not.toBe(b.wrappedKekIv);
    expect(a.wrappedKek).not.toBe(b.wrappedKek);
  });

  it('rejects unwrap with a different factor (export_key swap)', async () => {
    const kek = randomBytes(32);
    const ikm1 = randomBytes(32);
    const ikm2 = randomBytes(32);
    const aad = buildKekAAD(userId, 'password');

    const wrapped = await wrapKekUnderFactor(kek, ikm1, aad);
    await expect(unwrapKekUnderFactor(wrapped, ikm2, aad)).rejects.toBeDefined();
  });

  it('rejects unwrap with mismatched AAD (different user id)', async () => {
    const kek = randomBytes(32);
    const ikm = randomBytes(32);
    const aadAlice = buildKekAAD(userId, 'password');
    const aadBob = buildKekAAD('99999999-9999-9999-9999-999999999999', 'password');

    const wrapped = await wrapKekUnderFactor(kek, ikm, aadAlice);
    await expect(unwrapKekUnderFactor(wrapped, ikm, aadBob)).rejects.toBeDefined();
  });

  it('rejects unwrap with mismatched factor tag (password ↔ passkey swap)', async () => {
    const kek = randomBytes(32);
    const ikm = randomBytes(32);
    const aadPassword = buildKekAAD(userId, 'password');
    const aadPasskey = buildKekAAD(userId, 'passkey');

    const wrapped = await wrapKekUnderFactor(kek, ikm, aadPassword);
    await expect(unwrapKekUnderFactor(wrapped, ikm, aadPasskey)).rejects.toBeDefined();
  });
});

describe('factor-wrap — main key under KEK (HKDF nodea:wrap-main + AES-GCM)', () => {
  const userId = 'deadbeef-1234-5678-9abc-def012345678';

  it('round-trip wrap → unwrap is identity', async () => {
    const mainKey = randomBytes(32);
    const kek = randomBytes(32);
    const aad = buildMainKeyAAD(userId);

    const wrapped = await wrapMainKeyUnderKek(mainKey, kek, aad);
    const back = await unwrapMainKeyUnderKek(wrapped, kek, aad);

    expect(Array.from(back)).toEqual(Array.from(mainKey));
  });

  it('rejects unwrap with a different KEK', async () => {
    const mainKey = randomBytes(32);
    const kekA = randomBytes(32);
    const kekB = randomBytes(32);
    const aad = buildMainKeyAAD(userId);

    const wrapped = await wrapMainKeyUnderKek(mainKey, kekA, aad);
    await expect(unwrapMainKeyUnderKek(wrapped, kekB, aad)).rejects.toBeDefined();
  });

  it('rejects unwrap with mismatched AAD (different user id)', async () => {
    const mainKey = randomBytes(32);
    const kek = randomBytes(32);
    const aadAlice = buildMainKeyAAD(userId);
    const aadBob = buildMainKeyAAD('00000000-0000-0000-0000-000000000000');

    const wrapped = await wrapMainKeyUnderKek(mainKey, kek, aadAlice);
    await expect(unwrapMainKeyUnderKek(wrapped, kek, aadBob)).rejects.toBeDefined();
  });

  it('produces independent ciphertexts for the same input (fresh IV)', async () => {
    const mainKey = randomBytes(32);
    const kek = randomBytes(32);
    const aad = buildMainKeyAAD(userId);

    const a = await wrapMainKeyUnderKek(mainKey, kek, aad);
    const b = await wrapMainKeyUnderKek(mainKey, kek, aad);

    expect(a.wrappedMainKeyIv).not.toBe(b.wrappedMainKeyIv);
    expect(a.wrappedMainKey).not.toBe(b.wrappedMainKey);
  });

  it('domain-separated from KEK wrap: same IKM + same AAD ≠ same ciphertext', async () => {
    // Sanity-check that nodea:wrap-main and nodea:wrap-kek derive
    // different sub-keys. We feed the same 32-byte IKM in both
    // roles and verify the resulting ciphertexts don't decrypt
    // under each other's expected unwrap.
    const sharedIkm = randomBytes(32);
    const payload = randomBytes(32);
    const userId2 = userId; // same AAD content, but distinct strings below

    const wrappedAsKek = await wrapKekUnderFactor(
      payload,
      sharedIkm,
      buildKekAAD(userId2, 'password'),
    );
    const wrappedAsMain = await wrapMainKeyUnderKek(
      payload,
      sharedIkm,
      buildMainKeyAAD(userId2),
    );

    // Cross-unwrap must fail: each label produces a different sub-key.
    await expect(
      unwrapKekUnderFactor(
        {
          wrappedKek: wrappedAsMain.wrappedMainKey,
          wrappedKekIv: wrappedAsMain.wrappedMainKeyIv,
        },
        sharedIkm,
        buildKekAAD(userId2, 'password'),
      ),
    ).rejects.toBeDefined();
  });
});
