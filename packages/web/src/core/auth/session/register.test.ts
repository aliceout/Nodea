import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Base64 } from '@nodea/shared';

/**
 * Phase A register split (prepare → finish). We mock ONLY the API client and
 * the OPAQUE handshake; the real crypto (bip39 + factor-wrap + WebCrypto)
 * runs, so the assertions are genuine round-trips rather than shape checks:
 *
 *   - `prepareRegistration` must NOT call `/finish` (the "no account until the
 *     quiz is passed" invariant — abandoning the ceremony leaves nothing).
 *   - the finish body carries a recovery factor that actually unwraps the KEK
 *     under `HKDF(entropy)` + AAD `…\x1frecovery`, and `recoveryCodeHash`
 *     genuinely equals `SHA-256(entropy)` for the returned mnemonic.
 */
const m = vi.hoisted(() => ({
  apiRegisterStart: vi.fn(),
  apiRegisterFinish: vi.fn(),
}));

vi.mock('../../api/client.ts', () => ({
  apiRegisterStart: m.apiRegisterStart,
  apiRegisterFinish: m.apiRegisterFinish,
}));

vi.mock('../opaque.ts', () => ({
  // 'A'*43 is valid base64url for 32 zero bytes → a usable HKDF IKM for the
  // password wrap (which we don't assert on; we only need it not to throw).
  clientRegisterStart: vi.fn(() => ({
    clientRegistrationState: 'state',
    registrationRequest: 'req',
  })),
  clientRegisterFinish: vi.fn(() => ({
    registrationRecord: 'record',
    exportKey: 'A'.repeat(43),
  })),
  opaqueReady: Promise.resolve(),
}));

import { recoveryMnemonicToEntropy, sha256Hex } from '../../crypto/bip39.ts';
import { buildKekAAD, unwrapKekUnderFactor } from '../../crypto/factor-wrap.ts';

import { finishRegistration, prepareRegistration } from './register.ts';

const USER_ID = 'user-123';

beforeEach(() => {
  vi.clearAllMocks();
  m.apiRegisterStart.mockResolvedValue({
    userId: USER_ID,
    registrationResponse: 'resp',
  });
});

describe('prepareRegistration', () => {
  it('does NOT POST /finish — no account is created until the quiz is passed', async () => {
    await prepareRegistration({ email: 'a@b.co', username: 'Al', password: 'pw' });
    expect(m.apiRegisterFinish).not.toHaveBeenCalled();
    expect(m.apiRegisterStart).toHaveBeenCalledOnce();
  });

  it('returns a finish body with all wrap blobs + a 64-hex recovery hash + a 12-word mnemonic', async () => {
    const { mnemonic, finishBody } = await prepareRegistration({
      email: 'a@b.co',
      username: 'Al',
      password: 'pw',
    });
    expect(mnemonic.trim().split(/\s+/)).toHaveLength(12);
    expect(finishBody.wrappedMainKey).toBeTruthy();
    expect(finishBody.wrappedKekPassword).toBeTruthy();
    expect(finishBody.wrappedKekRecovery).toBeTruthy();
    expect(finishBody.wrappedKekRecoveryIv).toBeTruthy();
    expect(finishBody.recoveryCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(finishBody.userId).toBe(USER_ID);
  });

  it('recoveryCodeHash equals SHA-256(entropy) of the returned mnemonic', async () => {
    const { mnemonic, finishBody } = await prepareRegistration({
      email: 'a@b.co',
      username: 'Al',
      password: 'pw',
    });
    const entropy = recoveryMnemonicToEntropy(mnemonic);
    expect(entropy).not.toBeNull();
    expect(finishBody.recoveryCodeHash).toBe(await sha256Hex(entropy!));
  });

  it('the recovery blob unwraps the KEK under HKDF(entropy) + AAD(userId,"recovery")', async () => {
    const { mnemonic, finishBody } = await prepareRegistration({
      email: 'a@b.co',
      username: 'Al',
      password: 'pw',
    });
    const entropy = recoveryMnemonicToEntropy(mnemonic)!;
    // Correct factor + AAD → a 32-byte KEK falls out (auth tag verifies).
    const kek = await unwrapKekUnderFactor(
      {
        wrappedKek: finishBody.wrappedKekRecovery as unknown as Base64,
        wrappedKekIv: finishBody.wrappedKekRecoveryIv as unknown as Base64,
      },
      entropy,
      buildKekAAD(USER_ID, 'recovery'),
    );
    expect(kek).toHaveLength(32);

    // Wrong AAD tag must reject — guards against a factor/AAD mix-up.
    await expect(
      unwrapKekUnderFactor(
        {
          wrappedKek: finishBody.wrappedKekRecovery as unknown as Base64,
          wrappedKekIv: finishBody.wrappedKekRecoveryIv as unknown as Base64,
        },
        entropy,
        buildKekAAD(USER_ID, 'password'),
      ),
    ).rejects.toBeDefined();
  });

  it('passes inviteToken through only when provided', async () => {
    const withInvite = await prepareRegistration({
      email: 'a@b.co',
      username: 'Al',
      password: 'pw',
      inviteToken: 'tok-123456789012',
    });
    expect(withInvite.finishBody.inviteToken).toBe('tok-123456789012');

    const without = await prepareRegistration({
      email: 'a@b.co',
      username: 'Al',
      password: 'pw',
    });
    expect('inviteToken' in without.finishBody).toBe(false);
  });
});

describe('finishRegistration', () => {
  it('POSTs the prepared body and maps {activated, email}', async () => {
    m.apiRegisterFinish.mockResolvedValue({ activated: true, email: 'a@b.co' });
    const body = { userId: USER_ID } as Parameters<typeof finishRegistration>[0];
    const result = await finishRegistration(body);
    expect(m.apiRegisterFinish).toHaveBeenCalledWith(body);
    expect(result).toEqual({ activated: true, email: 'a@b.co' });
  });

  it('omits email when the API does not return one', async () => {
    m.apiRegisterFinish.mockResolvedValue({ activated: false });
    const result = await finishRegistration({} as Parameters<typeof finishRegistration>[0]);
    expect(result).toEqual({ activated: false });
    expect('email' in result).toBe(false);
  });
});
