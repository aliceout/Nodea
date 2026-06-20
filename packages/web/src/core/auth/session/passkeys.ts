import type { Base64 } from '@nodea/shared';

import {
  apiLogout,
  apiMe,
  apiMeCrypto,
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
} from '../passkey/index.ts';
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

  // Fetch wrap blobs (API-14 split — /auth/me no longer carries
  // them). Passed down to enrollPasskey for the password-derived
  // KEK unwrap step.
  const crypto = await apiMeCrypto();
  const result = await enrollPasskey({
    user: {
      id: user.id,
      email: user.email,
      wrappedKekPassword: crypto.wrappedKekPassword,
      wrappedKekPasswordIv: crypto.wrappedKekPasswordIv,
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
 *   - **Rejected (non-PRF, mode `password_or_passkey`)** : the
 *     credential authenticates but yields no PRF output, so the main
 *     key is unreachable. Rather than leave the user
 *     authenticated-but-keyless (a state every /flow hop bounces out
 *     of), we drop the just-created session and reset the store, then
 *     return `fullyUnlocked: false`. The caller surfaces « Saisis ton
 *     mot de passe pour finaliser » and the user signs in with their
 *     password (a full re-auth that derives the key).
 *   - **Stepped MFA (non-PRF, mode `always_2fa`/`maximum`)** : the
 *     server emits `mfa_pending`; the password is collected as a
 *     second factor on that pending session (see the `needsMfa`
 *     branch), so the session is kept, not dropped.
 *
 * Throws on a missing assertion (user cancelled, no credential
 * matched, server rejected) — same as the password flow.
 */
export async function passkeyLogin(
  deps: PasskeyDeps,
  input: { email?: string },
): Promise<{
  /** False when the credential is non-PRF or PRF deferred. On the
   *  `password_or_passkey` path the session has already been dropped
   *  and the store reset by this point, so the caller just shows the
   *  « finish with your password » prompt — there is no lingering
   *  signed-in shell to refresh into. On the stepped-MFA path the
   *  session is kept (pending) and the password is the next factor. */
  fullyUnlocked: boolean;
  /** Phase 5C — true when the server emitted `mfa_pending` because
   *  the user's `security_mode` requires factors beyond passkey.
   *  Caller navigates to `/login/mfa` to drive the next step. */
  needsMfa: boolean;
  factorsNeeded: ReadonlyArray<'totp' | 'passkey' | 'password'>;
  /** Issue #72 — alternatives flag forwarded for shape parity with
   *  the password-first path. Passkey-first never has OR today. */
  secondFactorChoice: boolean;
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
      // prfOutput can be non-null here even when wrappedKek is (the
      // authenticator surfaced a PRF output but the server has no KEK
      // wrap for this credential). Zero those ephemeral bytes rather
      // than leave them for GC (CLAUDE.md crypto rule 7).
      if (result.prfOutput) result.prfOutput.fill(0);
      deps.markKeyMissing();
      return {
        fullyUnlocked: false,
        needsMfa: true,
        factorsNeeded: result.factorsNeeded,
        secondFactorChoice: result.secondFactorChoice,
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
      secondFactorChoice: result.secondFactorChoice,
    };
  }

  // Original full-session path — pre-Phase-5C behaviour (mode
  // `password_or_passkey`, where a passkey assertion is a complete
  // login on its own).
  //
  // Gate on PRF FIRST, before hydrating /me or touching the auth
  // slice. A non-PRF passkey authenticates (the server already set a
  // full-session cookie) but can't unwrap the main key. Accepting it
  // would leave the user authenticated-but-keyless — every later hop
  // to /flow then bounces straight back out via the Layout's
  // key-missing guard (the "passkey lets me in, then kicks me to
  // /login" bug). So reject it at the source: drop the session the
  // server just created and tell the caller to fall back to the
  // password form (« Saisis ton mot de passe pour finaliser »), which
  // is a full re-auth that derives the key cleanly. Stepped-MFA modes
  // keep their own non-PRF handling above — there the password is a
  // second factor on the still-pending session, not a fresh login.
  if (
    !result.prfSupported ||
    result.prfOutput === null ||
    result.wrappedKek === null ||
    result.wrappedKekIv === null
  ) {
    // Zero any ephemeral PRF bytes the authenticator surfaced before
    // we bail (CLAUDE.md crypto rule 7) — reachable when wrappedKek is
    // the null clause that tripped this gate.
    if (result.prfOutput) result.prfOutput.fill(0);
    try {
      await apiLogout();
    } catch {
      // Best-effort — even if the server-side logout call fails, we
      // still reset the client below so the SPA never carries a
      // keyless authenticated session into /flow.
    }
    deps.setAuth(null);
    deps.setMainKey(null);
    return {
      fullyUnlocked: false,
      needsMfa: false,
      factorsNeeded: [],
      secondFactorChoice: false,
    };
  }

  const me = await apiMe();
  if (!me) {
    throw new Error('passkey-login: server accepted assertion but /me returned null');
  }
  deps.setAuth(me);

  // Fetch wrap blobs (API-14 split). Only the main-key wrap is
  // used here — the KEK comes from the PRF output below, not
  // from the password.
  const crypto = await apiMeCrypto();
  if (
    crypto.wrappedMainKey === null ||
    crypto.wrappedMainKeyIv === null
  ) {
    throw new Error('passkey-login: user row missing OPAQUE wrap blobs');
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
          wrappedMainKey: crypto.wrappedMainKey as unknown as Base64,
          wrappedMainKeyIv: crypto.wrappedMainKeyIv as unknown as Base64,
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

  return {
    fullyUnlocked: true,
    needsMfa: false,
    factorsNeeded: [],
    secondFactorChoice: false,
  };
}
