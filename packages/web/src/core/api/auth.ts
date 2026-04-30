import {
  AuthMeResponseSchema,
  type AuthMeResponse,
  type ChangeEmailBody,
  type ChangePasswordFinishBody,
  type ChangePasswordStartBody,
  type ChangePasswordStartResponse,
  type ChangeUsernameBody,
  type DeleteSelfBody,
  type OpaqueLoginFinishBody,
  type OpaqueLoginFinishResponse,
  type OpaqueLoginStartBody,
  type OpaqueLoginStartResponse,
  type OpaqueRegisterFinishBody,
  type OpaqueRegisterStartBody,
  type OpaqueRegisterStartResponse,
  type ReauthOkResponse,
  type ReauthPasskeyFinishBody,
  type ReauthPasskeyStartBody,
  type ReauthPasskeyStartResponse,
  type ReauthPasswordFinishBody,
  type ReauthPasswordStartBody,
  type ReauthPasswordStartResponse,
  type RecoverKekFinishBody,
  type RecoverKekStartBody,
  type RecoverKekStartResponse,
  type RecoveryCodeUpsertBody,
  type RegisterBody,
  type RequestResetBody,
  type ResetPasswordFinishBody,
  type ResetPasswordStartBody,
  type ResetPasswordStartResponse,
} from '@nodea/shared';
import type {
  InviteInfoResponse,
  RegisterActivateBody,
  RegisterModeResponse,
} from '@nodea/shared/schemas/auth-register-v2';

import { isApiError, request } from './internal.ts';

/* ----------------------------------------------------------------
 * Register flow (Auth-Roadmap Phase 1, post-rework v2)
 *
 * Two paths into a single submit endpoint:
 *   - invited:  /register?invite=<token> → form has email pre-filled
 *                (read-only) → submit with `inviteToken` → instant
 *                activation (one email exchange total).
 *   - open:     /register without a token → submit creates inactive
 *                account → activation email → click → activated.
 * -------------------------------------------------------------- */

export async function apiRegister(body: RegisterBody): Promise<{ id: string }> {
  return request<{ id: string }>('POST', '/auth/register', body);
}

/**
 * The register flow on mount: tells the page whether the open-
 * registration toggle is on, so it can branch between "show form"
 * and "show invitation-only" panel.
 */
export async function apiRegisterMode(): Promise<RegisterModeResponse> {
  return request<RegisterModeResponse>('GET', '/auth/register/mode');
}

/**
 * Look up an invite token to get the email it was issued for. The
 * register page calls this after reading `?invite=<token>` from the
 * URL, then pre-fills (and locks) the email field. Returns null on
 * 404 (invalid / expired / consumed) so the UI can show a "lien
 * invalide" panel without try/catching everywhere.
 */
export async function apiRegisterInviteInfo(
  token: string,
): Promise<InviteInfoResponse | null> {
  try {
    return await request<InviteInfoResponse>(
      'GET',
      `/auth/register/invite-info?token=${encodeURIComponent(token)}`,
    );
  } catch (err) {
    if (isApiError(err) && err.status === 404) return null;
    throw err;
  }
}

/**
 * OPAQUE register step 1 — exchanges the client's
 * `registrationRequest` for the server's response blob plus a
 * fresh `userId` the client uses to compute AAD bindings.
 */
export async function apiRegisterStart(
  body: OpaqueRegisterStartBody,
): Promise<OpaqueRegisterStartResponse> {
  return request<OpaqueRegisterStartResponse>('POST', '/auth/register/start', body);
}

/**
 * OPAQUE register step 2 — ships the persisted `registrationRecord`
 * (envelope) plus the wrapped main key + KEK blobs. Server creates
 * the user + opaque_records row.
 */
export async function apiRegisterFinish(
  body: OpaqueRegisterFinishBody,
): Promise<{ ok: true; activated: boolean; email?: string }> {
  return request<{ ok: true; activated: boolean; email?: string }>(
    'POST',
    '/auth/register/finish',
    body,
  );
}

export async function apiRegisterActivate(
  body: RegisterActivateBody,
): Promise<{ ok: true; email: string }> {
  return request<{ ok: true; email: string }>(
    'POST',
    '/auth/register/activate',
    body,
  );
}

/* ----------------------------------------------------------------
 * Login (OPAQUE)
 * -------------------------------------------------------------- */

/**
 * OPAQUE login step 1 — exchanges the client's `startLoginRequest`
 * for the server's `loginResponse` blob plus a `loginToken` the
 * client must echo at /finish so the server can pick up its
 * intermediate state (single-use, 5-minute TTL).
 */
export async function apiLoginStart(
  body: OpaqueLoginStartBody,
): Promise<OpaqueLoginStartResponse> {
  return request<OpaqueLoginStartResponse>('POST', '/auth/login/start', body);
}

/**
 * OPAQUE login step 2 — sends the client's `finishLoginRequest`
 * (computed locally from the `loginResponse` + the password). On
 * success the server emits a session cookie; the body is a
 * discriminated union (Auth-Roadmap Phase 5C):
 *
 *   - `needsMfa: false` → session is `full`, client follows the
 *     normal post-login path (call `/auth/me`, etc.).
 *   - `needsMfa: true` → session is `mfa_pending`. The body inlines
 *     the wrap blobs the client needs to unwrap the KEK + main key
 *     locally (since `/auth/me` refuses pending sessions); the
 *     client must drive `/auth/mfa/totp/verify` next.
 */
export async function apiLoginFinish(
  body: OpaqueLoginFinishBody,
): Promise<OpaqueLoginFinishResponse> {
  return request<OpaqueLoginFinishResponse>('POST', '/auth/login/finish', body);
}

export async function apiLogout(): Promise<void> {
  await request<void>('POST', '/auth/logout');
}

export async function apiMe(): Promise<AuthMeResponse | null> {
  try {
    const raw = await request<unknown>('GET', '/auth/me');
    return AuthMeResponseSchema.parse(raw);
  } catch (err) {
    if (isApiError(err) && err.status === 401) return null;
    throw err;
  }
}

/* ----------------------------------------------------------------
 * Re-auth (Auth-Roadmap Phase 7A foundation, Phase 7B wiring).
 *
 * `requireFreshPassword` / `requireFreshPasswordOrPasskey` middleware
 * on the server side gates every mutating Settings action: if the
 * caller's `reauth_*_at` timestamp is older than 5 min, the call
 * 401s with `{ error:'reauth_required', reauth_required:'password'
 * | 'password_or_passkey' }`. The SPA intercepts that, prompts the
 * user via the re-auth modal, hits the matching endpoint here, then
 * retries the original action.
 * -------------------------------------------------------------- */

export async function apiReauthPasswordStart(
  body: ReauthPasswordStartBody,
): Promise<ReauthPasswordStartResponse> {
  return request<ReauthPasswordStartResponse>(
    'POST',
    '/auth/reauth/password/start',
    body,
  );
}

export async function apiReauthPasswordFinish(
  body: ReauthPasswordFinishBody,
): Promise<ReauthOkResponse> {
  return request<ReauthOkResponse>('POST', '/auth/reauth/password/finish', body);
}

export async function apiReauthPasskeyStart(
  body: ReauthPasskeyStartBody,
): Promise<ReauthPasskeyStartResponse> {
  return request<ReauthPasskeyStartResponse>(
    'POST',
    '/auth/reauth/passkey/start',
    body,
  );
}

export async function apiReauthPasskeyFinish(
  body: ReauthPasskeyFinishBody,
): Promise<ReauthOkResponse> {
  return request<ReauthOkResponse>('POST', '/auth/reauth/passkey/finish', body);
}

/* ----------------------------------------------------------------
 * Account mutations (change password / email / username / delete).
 * -------------------------------------------------------------- */

export async function apiChangePasswordStart(
  body: ChangePasswordStartBody,
): Promise<ChangePasswordStartResponse> {
  return request<ChangePasswordStartResponse>(
    'POST',
    '/auth/change-password/start',
    body,
  );
}

export async function apiChangePasswordFinish(
  body: ChangePasswordFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/change-password/finish', body);
}

export async function apiChangeEmail(body: ChangeEmailBody): Promise<void> {
  await request<void>('PATCH', '/auth/email', body);
}

export async function apiChangeUsername(body: ChangeUsernameBody): Promise<void> {
  await request<void>('PATCH', '/auth/username', body);
}

export async function apiCompleteOnboarding(): Promise<void> {
  await request<void>('POST', '/auth/onboarding/complete');
}

export async function apiDeleteMe(body: DeleteSelfBody): Promise<void> {
  await request<void>('DELETE', '/auth/me', body);
}

/* ----------------------------------------------------------------
 * Password reset / recovery code / recover KEK.
 * -------------------------------------------------------------- */

export async function apiRequestPasswordReset(body: RequestResetBody): Promise<void> {
  await request<void>('POST', '/auth/request-reset', body);
}

/**
 * Recovery-code KEK setup / regenerate (Auth-Roadmap Phase 3).
 * Server gates on whether `recovery_code_hash IS NULL`:
 *   - first-time setup: just `requireUser`.
 *   - regenerate: also requires `proofLoginToken` +
 *     `proofFinishLoginRequest` from a fresh OPAQUE login start.
 */
export async function apiRecoveryCodeUpsert(
  body: RecoveryCodeUpsertBody,
): Promise<{ ok: true; regenerated: boolean }> {
  return request<{ ok: true; regenerated: boolean }>(
    'POST',
    '/auth/security/recovery-code',
    body,
  );
}

export async function apiRecoverKekStart(
  body: RecoverKekStartBody,
): Promise<RecoverKekStartResponse> {
  return request<RecoverKekStartResponse>('POST', '/auth/recover-kek/start', body);
}

export async function apiRecoverKekFinish(
  body: RecoverKekFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/recover-kek/finish', body);
}

export async function apiResetPasswordStart(
  body: ResetPasswordStartBody,
): Promise<ResetPasswordStartResponse> {
  return request<ResetPasswordStartResponse>('POST', '/auth/reset/start', body);
}

export async function apiResetPasswordFinish(
  body: ResetPasswordFinishBody,
): Promise<void> {
  await request<void>('POST', '/auth/reset/finish', body);
}
