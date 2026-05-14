import type { Base64 } from '@nodea/shared';

import {
  apiMe,
  apiMeCrypto,
  apiRecoverKekFinish,
  apiRecoverKekStart,
  apiRecoveryCodeUpsert,
} from '../../api/client.ts';
import {
  generateRecoveryMnemonic,
  recoveryMnemonicToEntropy,
} from '../../crypto/bip39.ts';
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
  opaqueReady,
} from '../opaque.ts';
import type { SessionUser } from '../../store/nodea-store.ts';

import type {
  SessionRecoverInput,
  SessionRecoveryCodeResult,
  SetAuth,
  SetMainKey,
} from './types.ts';

interface RecoveryCodeDeps {
  user: SessionUser | null;
  setAuth: SetAuth;
  setMainKey: SetMainKey;
}

/**
 * First-time setup OR rotate the user's BIP39 recovery code.
 * Same flow either way:
 *
 *   1. Re-derive `currentExportKey` via OPAQUE login start (so we
 *      can unwrap the user's KEK locally without trusting the
 *      session for a privileged op).
 *   2. Unwrap KEK using `currentExportKey` + the existing
 *      `wrappedKekPassword`.
 *   3. Generate a fresh BIP39 mnemonic + entropy.
 *   4. Wrap KEK under `HKDF(entropy, "nodea:wrap-kek")` →
 *      `wrappedKekRecovery`.
 *   5. Compute `SHA-256(entropy)` → `recoveryCodeHash`.
 *   6. POST `/auth/security/recovery-code` with the OPAQUE proof
 *      (always required) + the new wrap blobs + hash.
 *   7. Refresh `/me` so the sidebar tip + `recoveryCodeSet` flag
 *      flip to true; return the mnemonic for one-shot display.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a
 * wrong currentPassword (client-side `finishLogin` returns
 * undefined). The caller surfaces a friendly UI message.
 */
export async function setupRecoveryCode(
  deps: RecoveryCodeDeps,
  currentPassword: string,
): Promise<SessionRecoveryCodeResult> {
  const user = deps.user;
  if (!user) throw new Error('setupRecoveryCode: no authenticated user');

  // Fetch wrap blobs (API-14 split — /auth/me no longer ships them).
  const crypto = await apiMeCrypto();
  if (
    crypto.wrappedKekPassword === null ||
    crypto.wrappedKekPasswordIv === null
  ) {
    throw new Error(
      'setupRecoveryCode: user row is missing the OPAQUE wrap blobs',
    );
  }
  // Step 1+2 (Phase 7B): re-auth via /auth/reauth/password (also
  // bumps `reauth_password_at` for the upcoming POST), then use
  // the same exportKey to unwrap the current KEK.
  const { exportKey } = await freshenPasswordReauth(currentPassword);

  const kekBytes = await unwrapKekUnderFactor(
    {
      wrappedKek: crypto.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: crypto.wrappedKekPasswordIv as unknown as Base64,
    },
    exportKey,
    buildKekAAD(user.id, 'password'),
  );

  // Step 3-5: fresh BIP39, wrap KEK under it, compute hash.
  const { mnemonic, entropy } = generateRecoveryMnemonic();
  try {
    const recoveryWrap = await wrapKekUnderFactor(
      kekBytes,
      // factor-wrap accepts string (base64url) OR Uint8Array;
      // BIP39 entropy comes as Uint8Array directly.
      entropy,
      buildKekAAD(user.id, 'recovery'),
    );

    const { sha256Hex } = await import('../../crypto/bip39.ts');
    const recoveryCodeHash = await sha256Hex(entropy);

    // Step 6: POST. Re-auth gate is now the
    // `requireFreshPassword` middleware on the server, satisfied
    // by the timestamp bumped at step 1.
    const result = await apiRecoveryCodeUpsert({
      wrappedKekRecovery: recoveryWrap.wrappedKek,
      wrappedKekRecoveryIv: recoveryWrap.wrappedKekIv,
      recoveryCodeHash,
    });

    // Step 7: refresh /me so `recoveryCodeSet` flips.
    const me = await apiMe();
    if (me) deps.setAuth(me);

    return { mnemonic, regenerated: result.regenerated };
  } finally {
    entropy.fill(0);
    kekBytes.fill(0);
  }
}

/**
 * Drive the full recover-with-code flow : typed mnemonic + new
 * password → unwrap KEK locally → fresh OPAQUE registration on
 * the new password → re-wrap KEK under the new `exportKey` →
 * ship to /finish.
 *
 * The OLD recovery code is invalidated server-side (the
 * `wrappedKekRecovery` blob + `recoveryCodeHash` are nulled out).
 * The user is dropped in the « no recovery code configured » state
 * — the sidebar tip reappears (driven by `recoveryCodeSet: false`
 * on `/auth/me`) and they can define a new code at their leisure
 * via `/recovery-code`. No same-flow rotation, no new mnemonic to
 * memorise on the spot. The notification email mentions the old
 * code is now invalid.
 *
 * Throws on :
 *   - Bad mnemonic shape (wrong word count, unknown word, bad
 *     checksum) → `Error('invalid_recovery_code')`.
 *   - Wrong code (server `recovery_code_hash` mismatch) →
 *     `{ status: 401, error: 'invalid_credentials' }` from the
 *     /finish response.
 *   - Anti-enum on unknown email → also surfaces as 401 at
 *     /finish time.
 */
export async function recoverWithCode(
  deps: { setAuth: SetAuth; setMainKey: SetMainKey },
  input: SessionRecoverInput,
): Promise<void> {
  await opaqueReady;

  const entropy = recoveryMnemonicToEntropy(input.mnemonic);
  if (!entropy) throw new Error('invalid_recovery_code');

  try {
    // Step 1: OPAQUE registration start with the new password.
    const reg = clientRegisterStart(input.newPassword);

    // Step 2: /recover-kek/start — we hand over email +
    // registrationRequest, the server hands back the user's
    // wrappedKekRecovery + a registrationResponse + a session id
    // + the userId (for AAD).
    const start = await apiRecoverKekStart({
      email: input.email,
      registrationRequest: reg.registrationRequest,
    });

    // Step 3: try to unwrap the KEK locally with the typed
    // entropy. AAD = nodea:v1\x1f<userId>\x1frecovery. For
    // unknown-email cases the server returned random blobs that
    // will fail the auth-tag check; same shape as a real wrong-
    // code attempt. We surface the failure as a generic
    // "invalid_recovery_code" so the UI doesn't leak which leg
    // it failed on.
    let kekBytes: Uint8Array;
    try {
      kekBytes = await unwrapKekUnderFactor(
        {
          wrappedKek: start.wrappedKekRecovery as unknown as Base64,
          wrappedKekIv: start.wrappedKekRecoveryIv as unknown as Base64,
        },
        entropy,
        buildKekAAD(start.userId, 'recovery'),
      );
    } catch {
      throw new Error('invalid_recovery_code');
    }

    try {
      // Step 4: complete OPAQUE registration locally with the new
      // password to get the new envelope + new exportKey.
      const newReg = clientRegisterFinish({
        password: input.newPassword,
        clientRegistrationState: reg.clientRegistrationState,
        registrationResponse: start.registrationResponse,
      });

      // Step 5: re-wrap KEK under the new exportKey.
      const newKekWrap = await wrapKekUnderFactor(
        kekBytes,
        newReg.exportKey,
        buildKekAAD(start.userId, 'password'),
      );

      // Step 6: ship to /finish. Server replaces the password
      // credential AND nulls out the recovery code (the typed
      // mnemonic is now consumed, useless if leaked elsewhere).
      const { sha256Hex } = await import('../../crypto/bip39.ts');
      const oldHash = await sha256Hex(entropy);

      await apiRecoverKekFinish({
        recoverSessionId: start.recoverSessionId,
        recoveryCodeHash: oldHash,
        registrationRecord: newReg.registrationRecord,
        wrappedKekPassword: newKekWrap.wrappedKek,
        wrappedKekPasswordIv: newKekWrap.wrappedKekIv,
      });

      // Server has minted a fresh session cookie + replaced the
      // password credential. Hydrate `/me` so the rest of the app
      // picks up the new state — including `recoveryCodeSet:
      // false` so the « configure a recovery code » sidebar tip
      // reappears. Then fetch `/me/crypto` (API-14 split) to get
      // the unchanged `wrappedMainKey` blob — we still need it to
      // derive the in-memory main-key material with the KEK we
      // just unwrapped.
      const me = await apiMe();
      if (me) deps.setAuth(me);

      const crypto = await apiMeCrypto();
      if (
        me &&
        crypto.wrappedMainKey !== null &&
        crypto.wrappedMainKeyIv !== null
      ) {
        const rawMainKey = await unwrapMainKeyUnderKek(
          {
            wrappedMainKey: crypto.wrappedMainKey as unknown as Base64,
            wrappedMainKeyIv: crypto.wrappedMainKeyIv as unknown as Base64,
          },
          kekBytes,
          buildMainKeyAAD(me.id),
        );
        try {
          const material = await deriveMainKeys(rawMainKey);
          deps.setMainKey(material);
        } finally {
          rawMainKey.fill(0);
        }
      }
    } finally {
      kekBytes.fill(0);
    }
  } finally {
    entropy.fill(0);
  }
}
