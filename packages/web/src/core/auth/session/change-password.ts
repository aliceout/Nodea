import type { Base64 } from '@nodea/shared';

import {
  apiChangePasswordFinish,
  apiChangePasswordStart,
  apiMe,
  apiMeCrypto,
} from '../../api/client.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  unwrapKekUnderFactor,
  unwrapMainKeyUnderKek,
  wrapKekUnderFactor,
} from '../../crypto/factor-wrap.ts';
import { deriveMainKeys } from '../../crypto/key-material.ts';
import {
  clientRegisterFinish,
  clientRegisterStart,
  freshenPasswordReauth,
} from '../opaque.ts';
import type { SessionUser } from '../../store/nodea-store.ts';

import type {
  SessionChangePasswordInput,
  SetAuth,
  SetMainKey,
} from './types.ts';

interface ChangePasswordDeps {
  user: SessionUser | null;
  setAuth: SetAuth;
  setMainKey: SetMainKey;
}

export async function changePassword(
  deps: ChangePasswordDeps,
  input: SessionChangePasswordInput,
): Promise<void> {
  const user = deps.user;
  if (!user) throw new Error('changePassword: no authenticated user');

  // Fetch the OPAQUE wrap blobs (API-14 split — the lean /auth/me
  // no longer carries them; we hit /auth/me/crypto only at unwrap
  // moments like this one).
  const crypto = await apiMeCrypto();
  if (
    crypto.wrappedMainKey === null ||
    crypto.wrappedMainKeyIv === null ||
    crypto.wrappedKekPassword === null ||
    crypto.wrappedKekPasswordIv === null
  ) {
    throw new Error('changePassword: user row is missing the OPAQUE wrap blobs');
  }
  // Step 1 (Phase 7B): re-auth on the current password via
  // /auth/reauth/password, which also bumps
  // `reauth_password_at` so the upcoming /change-password/start
  // passes `requireFreshPasswordOrPasskey`. The same OPAQUE
  // round-trip gives us `currentExportKey` for the local KEK
  // unwrap.
  const { exportKey: currentExportKey } = await freshenPasswordReauth(
    input.currentPassword,
  );

  // Step 2: unwrap the current KEK using `currentExportKey`.
  const kekBytes = await unwrapKekUnderFactor(
    {
      wrappedKek: crypto.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: crypto.wrappedKekPasswordIv as unknown as Base64,
    },
    currentExportKey,
    buildKekAAD(user.id, 'password'),
  );

  try {
    // Step 3: ship a fresh `registrationRequest` (for the new
    // password) to `/change-password/start`, which now relies on
    // the middleware-gated freshness above.
    const newRegStart = clientRegisterStart(input.newPassword);
    const startRes = await apiChangePasswordStart({
      registrationRequest: newRegStart.registrationRequest,
    });

    // Step 4: complete the OPAQUE registration locally with the
    // new password to get the new envelope + `newExportKey`.
    const newRegFinished = clientRegisterFinish({
      password: input.newPassword,
      clientRegistrationState: newRegStart.clientRegistrationState,
      registrationResponse: startRes.registrationResponse,
    });

    // Step 5: re-wrap the SAME KEK under the new exportKey.
    const newKekWrap = await wrapKekUnderFactor(
      kekBytes,
      newRegFinished.exportKey,
      buildKekAAD(user.id, 'password'),
    );

    // Step 6: ship everything to /change-password/finish.
    await apiChangePasswordFinish({
      changePasswordToken: startRes.changePasswordToken,
      registrationRecord: newRegFinished.registrationRecord,
      wrappedKekPassword: newKekWrap.wrappedKek,
      wrappedKekPasswordIv: newKekWrap.wrappedKekIv,
    });

    // The session cookie has been rotated by the server; refresh
    // /me + re-derive the in-memory main-key material from the
    // KEK we still have on hand (the wrapped main key didn't
    // change, so we don't need a fresh unwrap).
    const me = await apiMe();
    if (!me) throw new Error('change-password succeeded but /auth/me returned null');
    deps.setAuth(me);

    const rawMainKey = await unwrapMainKeyUnderKek(
      {
        wrappedMainKey: crypto.wrappedMainKey as unknown as Base64,
        wrappedMainKeyIv: crypto.wrappedMainKeyIv as unknown as Base64,
      },
      kekBytes,
      buildMainKeyAAD(user.id),
    );
    try {
      const material = await deriveMainKeys(rawMainKey);
      deps.setMainKey(material);
    } finally {
      rawMainKey.fill(0);
    }
  } finally {
    kekBytes.fill(0);
  }
}
