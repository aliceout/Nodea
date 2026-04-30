import type {
  PasskeyDeleteBody,
  PasskeyEnrollFinishBody,
  PasskeyEnrollFinishResponse,
  PasskeyEnrollStartBody,
  PasskeyEnrollStartResponse,
  PasskeyListResponse,
  PasskeyLoginFinishBody,
  PasskeyLoginFinishResponse,
  PasskeyLoginStartBody,
  PasskeyLoginStartResponse,
  PasskeyRenameWithProofBody,
} from '@nodea/shared';

import { request } from './internal.ts';

/* ----------------------------------------------------------------
 * Passkey / WebAuthn (Auth-Roadmap Phase 4)
 * -------------------------------------------------------------- */

/** Start enrollment — exchanges the OPAQUE password proof for the
 *  WebAuthn `creationOptions` to feed into `startRegistration`. */
export async function apiPasskeyEnrollStart(
  body: PasskeyEnrollStartBody,
): Promise<PasskeyEnrollStartResponse> {
  return request<PasskeyEnrollStartResponse>(
    'POST',
    '/auth/passkey/enroll/start',
    body,
  );
}

/** Finish enrollment — sends the attestation response + the wrapped
 *  KEK (when PRF-capable) so the server can persist the credential. */
export async function apiPasskeyEnrollFinish(
  body: PasskeyEnrollFinishBody,
): Promise<PasskeyEnrollFinishResponse> {
  return request<PasskeyEnrollFinishResponse>(
    'POST',
    '/auth/passkey/enroll/finish',
    body,
  );
}

export async function apiPasskeyList(): Promise<PasskeyListResponse> {
  return request<PasskeyListResponse>('GET', '/auth/passkey/list');
}

export async function apiPasskeyRename(
  id: string,
  body: PasskeyRenameWithProofBody,
): Promise<void> {
  await request<void>('PATCH', `/auth/passkey/${id}/label`, body);
}

export async function apiPasskeyRemove(
  id: string,
  body: PasskeyDeleteBody,
): Promise<void> {
  await request<void>('POST', `/auth/passkey/${id}/remove`, body);
}

/** Anonymous: request WebAuthn `requestOptions` for a passkey login.
 *  Server returns generic options (no `allowCredentials`) when `email`
 *  is absent or unknown — anti-enum + supports discoverable creds. */
export async function apiPasskeyLoginStart(
  body: PasskeyLoginStartBody,
): Promise<PasskeyLoginStartResponse> {
  return request<PasskeyLoginStartResponse>(
    'POST',
    '/auth/passkey/login/start',
    body,
  );
}

/** Anonymous: ship the assertion and receive the wrap blobs the
 *  client needs to unwrap the KEK + main key. */
export async function apiPasskeyLoginFinish(
  body: PasskeyLoginFinishBody,
): Promise<PasskeyLoginFinishResponse> {
  return request<PasskeyLoginFinishResponse>(
    'POST',
    '/auth/passkey/login/finish',
    body,
  );
}
