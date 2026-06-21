import {
  MfaBypassRequestResponseSchema,
  MfaPasskeyFinishResponseSchema,
  MfaPasskeyStartResponseSchema,
  MfaPasswordFinishResponseSchema,
  MfaPasswordStartResponseSchema,
  MfaTotpVerifyResponseSchema,
  type MfaBypassConfirmResponse,
  type MfaBypassRequestBody,
  type MfaBypassRequestResponse,
  type MfaPasskeyFinishBody,
  type MfaPasskeyFinishResponse,
  type MfaPasskeyStartBody,
  type MfaPasskeyStartResponse,
  type MfaPasswordFinishBody,
  type MfaPasswordFinishResponse,
  type MfaPasswordStartBody,
  type MfaPasswordStartResponse,
  type MfaTotpVerifyBody,
  type MfaTotpVerifyResponse,
} from '@nodea/shared';

import { apiBase, request } from './internal.ts';

/* ----------------------------------------------------------------
 * Stepped MFA (Auth-Roadmap Phase 5C)
 * -------------------------------------------------------------- */

/**
 * Submit a TOTP code (or backup code in the same field) against the
 * current `mfa_pending` session. On the response:
 *
 *   - `finalized: true` — the server promoted the session to `full`
 *     and swapped the cookie. Client should call `/auth/me` to load
 *     the public user shape and proceed.
 *   - `finalized: false` — at least one factor still missing
 *     (e.g. mode `maximum` may need a passkey-as-second-factor in
 *     Phase 5D). The `missing` array drives the next step.
 */
export async function apiMfaTotpVerify(
  body: MfaTotpVerifyBody,
): Promise<MfaTotpVerifyResponse> {
  return request(
    'POST',
    '/auth/mfa/totp/verify',
    body,
    MfaTotpVerifyResponseSchema,
  );
}

/** Passkey-as-second-factor — Phase 5D, used for mode `maximum`
 *  after the primary login. The session is `mfa_pending`; the route
 *  generates WebAuthn `requestOptions` scoped to this user's
 *  enrolled passkeys (no anti-enum needed — the user is already
 *  authenticated). Persists the challenge on the pending row. */
export async function apiMfaPasskeyStart(
  body: MfaPasskeyStartBody,
): Promise<MfaPasskeyStartResponse> {
  return request(
    'POST',
    '/auth/mfa/passkey/start',
    body,
    MfaPasskeyStartResponseSchema,
  );
}

export async function apiMfaPasskeyFinish(
  body: MfaPasskeyFinishBody,
): Promise<MfaPasskeyFinishResponse> {
  return request(
    'POST',
    '/auth/mfa/passkey/finish',
    body,
    MfaPasskeyFinishResponseSchema,
  );
}

/** Password-as-second-factor — used for mode `maximum` entered
 *  passkey-first, whose remaining factors are password + totp. The
 *  OPAQUE handshake runs against the `mfa_pending` session (identifier
 *  taken from the session, never sent in the body). On finalize the
 *  server promotes the row to `full` and swaps the cookie. */
export async function apiMfaPasswordStart(
  body: MfaPasswordStartBody,
): Promise<MfaPasswordStartResponse> {
  return request(
    'POST',
    '/auth/mfa/password/start',
    body,
    MfaPasswordStartResponseSchema,
  );
}

export async function apiMfaPasswordFinish(
  body: MfaPasswordFinishBody,
): Promise<MfaPasswordFinishResponse> {
  return request(
    'POST',
    '/auth/mfa/password/finish',
    body,
    MfaPasswordFinishResponseSchema,
  );
}

/* ----------------------------------------------------------------
 * MFA bypass (Auth-Roadmap Phase 6)
 * -------------------------------------------------------------- */

/** Request a bypass for a single factor from `/login/mfa`. The
 *  server emails confirm + cancel links; the user must click confirm
 *  + wait 7 days before the next login skips the factor. */
export async function apiMfaBypassRequest(
  body: MfaBypassRequestBody,
): Promise<MfaBypassRequestResponse> {
  return request(
    'POST',
    '/auth/mfa/bypass/request',
    body,
    MfaBypassRequestResponseSchema,
  );
}

/** Confirm a bypass via the email link. Reads the body even on 4xx
 *  / 410 because the server returns a discriminated `status` payload
 *  for every outcome (`ok`, `already_confirmed`, `cancelled`,
 *  `consumed`, `expired`, `unknown`). The SPA renders a different
 *  panel per status. */
export async function apiMfaBypassConfirm(
  token: string,
): Promise<MfaBypassConfirmResponse> {
  const res = await fetch(
    `${apiBase()}/auth/mfa/bypass/confirm?t=${encodeURIComponent(token)}`,
    { credentials: 'include' },
  );
  const body = (await res.json()) as MfaBypassConfirmResponse;
  return body;
}
