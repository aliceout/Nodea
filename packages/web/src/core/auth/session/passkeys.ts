import type { Base64 } from '@nodea/shared';

import {
  apiMe,
  apiPasskeyRemove,
  apiPasskeyRename,
} from '../../api/client.ts';
import {
  buildMainKeyAAD,
  unwrapMainKeyUnderKek,
} from '../../crypto/factor-wrap.ts';
import { deriveMainKeys } from '../../crypto/key-material.ts';
import { unwrapKekUnderPrf } from '../../crypto/passkey-prf.ts';
import {
  enrollPasskey,
  loginWithPasskey,
  type EnrollPasskeyResult,
} from '../passkey-flow.ts';
import type { SessionUser } from '../../store/nodea-store.ts';

import { freshenReauth } from './freshen-reauth.ts';
import type { MarkKeyMissing, SetAuth, SetMainKey } from './types.ts';

interface PasskeyDeps {
  user: SessionUser | null;
  setAuth: SetAuth;
  setMainKey: SetMainKey;
  markKeyMissing: MarkKeyMissing;
}

/**
 * Enroll a new passkey. Drives the OPAQUE password proof, the
 * WebAuthn registration ceremony, and the KEK wrap under PRF if
 * the authenticator surfaces one. Refreshes `/me` so the
 * `passkeysCount` flips and the sidebar tip disappears.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a
 * wrong currentPassword, and re-throws WebAuthn errors as-is so
 * the caller can branch on the user-cancelled / not-allowed shape.
 */
export async function enrollPasskeyFlow(
  deps: { user: SessionUser | null; setAuth: SetAuth },
  currentPassword: string,
  label: string,
): Promise<EnrollPasskeyResult> {
  const user = deps.user;
  if (!user) throw new Error('enrollPasskey: no authenticated user');

  const result = await enrollPasskey({
    user: {
      id: user.id,
      email: user.email,
      wrappedKekPassword: user.wrappedKekPassword,
      wrappedKekPasswordIv: user.wrappedKekPasswordIv,
    },
    currentPassword,
    label,
  });

  // Refresh /me so passkeysCount + passkeysPrfCount flip in the
  // store — the sidebar tip + Settings UI react automatically.
  const me = await apiMe();
  if (me) deps.setAuth(me);

  return result;
}

/**
 * Rename an enrolled passkey. Requires fresh password proof per
 * the matrice de re-auth (§6).
 */
export async function renamePasskey(
  deps: { user: SessionUser | null },
  id: string,
  currentPassword: string,
  label: string,
): Promise<void> {
  if (!deps.user) throw new Error('renamePasskey: no authenticated user');
  await freshenReauth(currentPassword);
  await apiPasskeyRename(id, { label });
}

/**
 * Remove an enrolled passkey. Requires fresh password proof per
 * the matrice. Server handles the §6.1 downgrade auto when the
 * deletion takes the last PRF-capable credential under
 * `security_mode = 'maximum'`.
 */
export async function removePasskey(
  deps: { user: SessionUser | null; setAuth: SetAuth },
  id: string,
  currentPassword: string,
): Promise<void> {
  if (!deps.user) throw new Error('removePasskey: no authenticated user');
  await freshenReauth(currentPassword);
  await apiPasskeyRemove(id, {});
  // Refresh /me so passkeysCount drops accordingly.
  const me = await apiMe();
  if (me) deps.setAuth(me);
}

/**
 * Drive a full passkey-first login (Auth-Spec §7.3).
 *
 * Three outcomes possible:
 *   - **Full unlock** : the credential is PRF-capable AND the
 *     authenticator surfaced the PRF output. We unwrap the KEK,
 *     unwrap the main key, derive sub-keys, and the user lands
 *     fully signed in.
 *   - **Login-only**  : the credential is registered but not
 *     PRF-capable, OR the authenticator didn't surface the PRF
 *     output. The session cookie is set (the user IS authed) but
 *     the main key is unreachable from this credential alone — the
 *     UI must prompt for the password to finish unlocking.
 *
 * Throws on a missing assertion (user cancelled, no credential
 * matched, server rejected) — same as the password flow.
 */
export async function passkeyLogin(
  deps: PasskeyDeps,
  input: { email?: string },
): Promise<{
  /** False when the credential is non-PRF or PRF deferred — the
   *  caller should prompt for the password and call `login(...)`
   *  to finish the unwrap. The session cookie is already set by
   *  this point, so a refresh would still drop the user on a
   *  signed-in shell. */
  fullyUnlocked: boolean;
  /** Phase 5C — true when the server emitted `mfa_pending` because
   *  the user's `security_mode` requires factors beyond passkey.
   *  Caller navigates to `/login/mfa` to drive the next step. */
  needsMfa: boolean;
  factorsNeeded: ReadonlyArray<'totp' | 'passkey' | 'password'>;
}> {
  const result = await loginWithPasskey(
    input.email !== undefined ? { email: input.email } : {},
  );

  // Stepped MFA branch — `/auth/me` refuses pending sessions, so
  // we skip the user-shape hydration and use the wrap blobs from
  // the /finish response directly to derive the main key. The
  // auth slice stays null until MFA finalize promotes the session
  // and `verifyMfaTotp` calls /me.
  if (result.needsMfa) {
    // Login-only credential + needsMfa is rare but possible (mode
    // `maximum` user enrolled a non-PRF passkey). Without PRF we
    // can't unwrap the KEK from passkey alone; the caller will
    // chain a password login as the second factor.
    if (
      !result.prfSupported ||
      result.prfOutput === null ||
      result.wrappedKek === null ||
      result.wrappedKekIv === null
    ) {
      deps.markKeyMissing();
      return {
        fullyUnlocked: false,
        needsMfa: true,
        factorsNeeded: result.factorsNeeded,
      };
    }
    const prfOutput = result.prfOutput;
    try {
      const kekBytes = await unwrapKekUnderPrf(
        {
          wrappedKek: result.wrappedKek as unknown as Base64,
          wrappedKekIv: result.wrappedKekIv as unknown as Base64,
        },
        prfOutput,
        result.userId,
        result.credentialId,
      );
      let rawMainKey: Uint8Array;
      try {
        rawMainKey = await unwrapMainKeyUnderKek(
          {
            wrappedMainKey: result.wrappedMainKey as unknown as Base64,
            wrappedMainKeyIv: result.wrappedMainKeyIv as unknown as Base64,
          },
          kekBytes,
          buildMainKeyAAD(result.userId),
        );
      } finally {
        kekBytes.fill(0);
      }
      try {
        const material = await deriveMainKeys(rawMainKey);
        deps.setMainKey(material);
      } finally {
        rawMainKey.fill(0);
      }
    } finally {
      prfOutput.fill(0);
    }
    return {
      fullyUnlocked: true,
      needsMfa: true,
      factorsNeeded: result.factorsNeeded,
    };
  }

  // Original full-session path — pre-Phase-5C behaviour.
  const me = await apiMe();
  if (!me) {
    throw new Error('passkey-login: server accepted assertion but /me returned null');
  }
  deps.setAuth(me);
  if (
    me.wrappedMainKey === null ||
    me.wrappedMainKeyIv === null ||
    me.wrappedKekPassword === null ||
    me.wrappedKekPasswordIv === null
  ) {
    throw new Error('passkey-login: user row missing OPAQUE wrap blobs');
  }

  // Login-only path: no PRF output → the KEK can't be unwrapped
  // from this credential. The UI prompts for the password next.
  if (
    !result.prfSupported ||
    result.prfOutput === null ||
    result.wrappedKek === null ||
    result.wrappedKekIv === null
  ) {
    // We DON'T mark key missing here — the caller may chain a
    // password login immediately. If they don't, the
    // ProtectedRoute layer will catch the missing main key and
    // surface the prompt. Same UX as a cold reload.
    deps.markKeyMissing();
    return { fullyUnlocked: false, needsMfa: false, factorsNeeded: [] };
  }

  const prfOutput = result.prfOutput;
  try {
    const kekBytes = await unwrapKekUnderPrf(
      {
        wrappedKek: result.wrappedKek as unknown as Base64,
        wrappedKekIv: result.wrappedKekIv as unknown as Base64,
      },
      prfOutput,
      result.userId,
      result.credentialId,
    );
    let rawMainKey: Uint8Array;
    try {
      rawMainKey = await unwrapMainKeyUnderKek(
        {
          wrappedMainKey: me.wrappedMainKey as unknown as Base64,
          wrappedMainKeyIv: me.wrappedMainKeyIv as unknown as Base64,
        },
        kekBytes,
        buildMainKeyAAD(me.id),
      );
    } finally {
      kekBytes.fill(0);
    }
    try {
      const material = await deriveMainKeys(rawMainKey);
      deps.setMainKey(material);
    } finally {
      rawMainKey.fill(0);
    }
  } finally {
    prfOutput.fill(0);
  }

  return { fullyUnlocked: true, needsMfa: false, factorsNeeded: [] };
}
