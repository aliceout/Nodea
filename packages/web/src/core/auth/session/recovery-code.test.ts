import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit test for the Phase 3B `reverifyRecoveryCode` action. We mock the
 * typed client + crypto helpers so this exercises ONLY the orchestration:
 * the client-side BIP39 gate runs before any network call, the SHA-256 hash
 * is what gets POSTed, a success re-hydrates `/me` into the store, a server
 * 401 propagates unchanged (so the page can branch to « code invalide »),
 * and the entropy bytes are wiped in the `finally` on BOTH paths.
 *
 * The heavy crypto/opaque modules `recovery-code.ts` also imports (only used
 * by its sibling actions) are stubbed so importing the module stays light.
 */
const m = vi.hoisted(() => ({
  apiRecoveryCodeVerify: vi.fn(),
  apiMe: vi.fn(),
  recoveryMnemonicToEntropy: vi.fn(),
  sha256Hex: vi.fn(),
}));

vi.mock('../../api/client.ts', () => ({
  apiRecoveryCodeVerify: m.apiRecoveryCodeVerify,
  apiMe: m.apiMe,
  apiMeCrypto: vi.fn(),
  apiRecoverKekFinish: vi.fn(),
  apiRecoverKekStart: vi.fn(),
  apiRecoveryCodeUpsert: vi.fn(),
}));
vi.mock('../../crypto/bip39.ts', () => ({
  recoveryMnemonicToEntropy: m.recoveryMnemonicToEntropy,
  sha256Hex: m.sha256Hex,
  generateRecoveryMnemonic: vi.fn(),
}));
vi.mock('../../crypto/factor-wrap.ts', () => ({
  buildKekAAD: vi.fn(),
  buildMainKeyAAD: vi.fn(),
  unwrapKekUnderFactor: vi.fn(),
  unwrapMainKeyUnderKek: vi.fn(),
  wrapKekUnderFactor: vi.fn(),
}));
vi.mock('../../crypto/key-material.ts', () => ({ deriveMainKeys: vi.fn() }));
vi.mock('../opaque.ts', () => ({
  clientRegisterFinish: vi.fn(),
  clientRegisterStart: vi.fn(),
  freshenPasswordReauth: vi.fn(),
  opaqueReady: Promise.resolve(),
}));

import { reverifyRecoveryCode } from './recovery-code.ts';

const entropy16 = (fill: number): Uint8Array => new Uint8Array(16).fill(fill);

describe('reverifyRecoveryCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with invalid_recovery_code BEFORE any network call on a bad mnemonic shape', async () => {
    m.recoveryMnemonicToEntropy.mockReturnValue(null);
    const setAuth = vi.fn();

    await expect(
      reverifyRecoveryCode({ setAuth }, 'not a valid phrase'),
    ).rejects.toThrow('invalid_recovery_code');

    expect(m.apiRecoveryCodeVerify).not.toHaveBeenCalled();
    expect(m.apiMe).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
  });

  it('on success POSTs SHA-256(entropy) then re-hydrates /me into the store', async () => {
    m.recoveryMnemonicToEntropy.mockReturnValue(entropy16(1));
    m.sha256Hex.mockResolvedValue('f'.repeat(64));
    m.apiRecoveryCodeVerify.mockResolvedValue({ ok: true, streak: 1 });
    const refreshed = { id: 'u1', recoveryReverifyDue: false };
    m.apiMe.mockResolvedValue(refreshed);
    const setAuth = vi.fn();

    await reverifyRecoveryCode({ setAuth }, 'twelve word phrase here');

    expect(m.apiRecoveryCodeVerify).toHaveBeenCalledWith({ recoveryCodeHash: 'f'.repeat(64) });
    expect(m.apiMe).toHaveBeenCalledOnce();
    expect(setAuth).toHaveBeenCalledWith(refreshed);
  });

  it('wipes the entropy bytes after a successful verify (finally)', async () => {
    const entropy = entropy16(9);
    m.recoveryMnemonicToEntropy.mockReturnValue(entropy);
    m.sha256Hex.mockResolvedValue('a'.repeat(64));
    m.apiRecoveryCodeVerify.mockResolvedValue({ ok: true, streak: 3 });
    m.apiMe.mockResolvedValue({ id: 'u1' });

    await reverifyRecoveryCode({ setAuth: vi.fn() }, 'phrase');
    expect([...entropy].every((b) => b === 0)).toBe(true);
  });

  it('propagates a server 401 unchanged, skips the /me refresh, and still wipes entropy', async () => {
    const entropy = entropy16(7);
    m.recoveryMnemonicToEntropy.mockReturnValue(entropy);
    m.sha256Hex.mockResolvedValue('c'.repeat(64));
    const apiErr = Object.assign(new Error('unauthorized'), {
      status: 401,
      error: 'invalid_credentials',
    });
    m.apiRecoveryCodeVerify.mockRejectedValue(apiErr);
    const setAuth = vi.fn();

    await expect(reverifyRecoveryCode({ setAuth }, 'phrase')).rejects.toBe(apiErr);
    expect(m.apiMe).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
    expect([...entropy].every((b) => b === 0)).toBe(true);
  });

  it('does not call setAuth when /me returns null after a successful verify', async () => {
    m.recoveryMnemonicToEntropy.mockReturnValue(entropy16(3));
    m.sha256Hex.mockResolvedValue('d'.repeat(64));
    m.apiRecoveryCodeVerify.mockResolvedValue({ ok: true, streak: 1 });
    m.apiMe.mockResolvedValue(null);
    const setAuth = vi.fn();

    await reverifyRecoveryCode({ setAuth }, 'phrase');
    expect(setAuth).not.toHaveBeenCalled();
  });
});
