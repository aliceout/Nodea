import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

import { apiReauthPasskeyFinish, apiReauthPasskeyStart } from '../../api/client.ts';
import { freshenPasswordReauth } from '../opaque.ts';

/**
 * Phase 7B: bump `sessions.reauth_password_at = now()` so the next
 * mutating Settings call passes the `requireFreshPassword`
 * middleware. Wraps {@link freshenPasswordReauth} from
 * `core/auth/opaque.ts` — the helper-of-helpers exists here so the
 * mutating actions in this folder all read with one
 * `await freshenReauth(currentPassword)` line, which is the same
 * shape they had with the old `issuePasswordProof` minus the
 * proof-token plumbing.
 */
export async function freshenReauth(password: string): Promise<void> {
  await freshenPasswordReauth(password);
}

/**
 * Passkey counterpart : run a WebAuthn assertion against
 * `/auth/reauth/passkey/{start,finish}` so the session's
 * `reauth_passkey_at` is bumped and the next action gated on a fresh passkey
 * (today: account deletion, §6/§7.11) passes. Same ceremony as the stepped-MFA
 * passkey step. Throws WebAuthn errors verbatim (caller maps `NotAllowedError`
 * = user-cancel) and ApiError on a server reject.
 */
export async function freshenPasskeyReauth(): Promise<void> {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const startRes = await apiReauthPasskeyStart({});
  const assertion = await startAuthentication({
    optionsJSON:
      startRes.requestOptions as unknown as PublicKeyCredentialRequestOptionsJSON,
  });
  await apiReauthPasskeyFinish({
    assertionResponse: assertion as unknown as Record<string, unknown>,
  });
}
