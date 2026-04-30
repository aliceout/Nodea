import type { Base64 } from '@nodea/shared';

import {
  apiMe,
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
  if (
    user.wrappedKekPassword === null ||
    user.wrappedKekPasswordIv === null
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
      wrappedKek: user.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: user.wrappedKekPasswordIv as unknown as Base64,
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
 * Drive the full recover-with-code flow: typed mnemonic + new
 * password → unwrap KEK locally → fresh OPAQUE registration on
 * the new password → re-wrap KEK under the new `exportKey` AND
 * under a freshly-generated BIP39 entropy → ship to /finish.
 * Server replaces every credential blob in a transaction and
 * mints a fresh session cookie.
 *
 * The OLD recovery code is invalidated (its `wrappedKekRecovery`
 * blob is gone after /finish). The returned mnemonic is the NEW
 * code the user must save; show it once and prompt for the
 * "j'ai noté" acknowledgement before navigating away.
 *
 * Throws on:
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
): Promise<SessionRecoveryCodeResult> {
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

      // Step 6: generate a NEW BIP39 mnemonic — the old code is
      // invalidated as soon as /finish runs, so we must be ready
      // to display the replacement.
      const { mnemonic: newMnemonic, entropy: newEntropy } =
        generateRecoveryMnemonic();
      try {
        const newRecoveryWrap = await wrapKekUnderFactor(
          kekBytes,
          newEntropy,
          buildKekAAD(start.userId, 'recovery'),
        );
        const { sha256Hex } = await import('../../crypto/bip39.ts');
        const newHash = await sha256Hex(newEntropy);
        const oldHash = await sha256Hex(entropy);

        await apiRecoverKekFinish({
          recoverSessionId: start.recoverSessionId,
          recoveryCodeHash: oldHash,
          registrationRecord: newReg.registrationRecord,
          wrappedKekPassword: newKekWrap.wrappedKek,
          wrappedKekPasswordIv: newKekWrap.wrappedKekIv,
          wrappedKekRecoveryNew: newRecoveryWrap.wrappedKek,
          wrappedKekRecoveryNewIv: newRecoveryWrap.wrappedKekIv,
          recoveryCodeHashNew: newHash,
        });

        // Server has minted a fresh session cookie + replaced
        // every credential blob. Hydrate `/me` so the rest of
        // the app picks up the new state.
        const me = await apiMe();
        if (me) deps.setAuth(me);

        // Derive main-key material from the in-memory KEK we
        // just unwrapped (the wrapped_main_key blob didn't
        // change). The user lands on the app fully signed in.
        if (
          me?.wrappedMainKey !== undefined &&
          me?.wrappedMainKey !== null &&
          me?.wrappedMainKeyIv !== undefined &&
          me?.wrappedMainKeyIv !== null
        ) {
          const rawMainKey = await unwrapMainKeyUnderKek(
            {
              wrappedMainKey: me.wrappedMainKey as unknown as Base64,
              wrappedMainKeyIv: me.wrappedMainKeyIv as unknown as Base64,
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

        return { mnemonic: newMnemonic, regenerated: true };
      } finally {
        newEntropy.fill(0);
      }
    } finally {
      kekBytes.fill(0);
    }
  } finally {
    entropy.fill(0);
  }
}
