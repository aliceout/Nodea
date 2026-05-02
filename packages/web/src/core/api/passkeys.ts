import {
  PasskeyEnrollFinishResponseSchema,
  PasskeyEnrollStartResponseSchema,
  PasskeyListResponseSchema,
  PasskeyLoginFinishResponseSchema,
  PasskeyLoginStartResponseSchema,
  type PasskeyDeleteBody,
  type PasskeyEnrollFinishBody,
  type PasskeyEnrollFinishResponse,
  type PasskeyEnrollStartBody,
  type PasskeyEnrollStartResponse,
  type PasskeyListResponse,
  type PasskeyLoginFinishBody,
  type PasskeyLoginFinishResponse,
  type PasskeyLoginStartBody,
  type PasskeyLoginStartResponse,
  type PasskeyRenameWithProofBody,
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
  return request(
    'POST',
    '/auth/passkeys/enroll/start',
    body,
    PasskeyEnrollStartResponseSchema,
  );
}

/** Finish enrollment — sends the attestation response + the wrapped
 *  KEK (when PRF-capable) so the server can persist the credential. */
export async function apiPasskeyEnrollFinish(
  body: PasskeyEnrollFinishBody,
): Promise<PasskeyEnrollFinishResponse> {
  return request(
    'POST',
    '/auth/passkeys/enroll/finish',
    body,
    PasskeyEnrollFinishResponseSchema,
  );
}

/**
 * Wire shape is the uniform `{ data, meta }` envelope (audit API-06)
 * with `meta.prfCount`. We surface it to callers as
 * `{ passkeys, prfCount }` so the page-level code keeps reading the
 * count without having to know about the envelope.
 */
export async function apiPasskeyList(): Promise<{
  passkeys: PasskeyListResponse['data'];
  prfCount: number;
}> {
  const response = await request(
    'GET',
    '/auth/passkeys/list',
    undefined,
    PasskeyListResponseSchema,
  );
  return { passkeys: response.data, prfCount: response.meta.prfCount };
}

export async function apiPasskeyRename(
  id: string,
  body: PasskeyRenameWithProofBody,
): Promise<void> {
  await request<void>('PATCH', `/auth/passkeys/${id}/label`, body);
}

export async function apiPasskeyRemove(
  id: string,
  body: PasskeyDeleteBody,
): Promise<void> {
  await request<void>('POST', `/auth/passkeys/${id}/remove`, body);
}

/** Anonymous: request WebAuthn `requestOptions` for a passkey login.
 *  Server returns generic options (no `allowCredentials`) when `email`
 *  is absent or unknown — anti-enum + supports discoverable creds. */
export async function apiPasskeyLoginStart(
  body: PasskeyLoginStartBody,
): Promise<PasskeyLoginStartResponse> {
  return request(
    'POST',
    '/auth/passkeys/login/start',
    body,
    PasskeyLoginStartResponseSchema,
  );
}

/** Anonymous: ship the assertion and receive the wrap blobs the
 *  client needs to unwrap the KEK + main key. */
export async function apiPasskeyLoginFinish(
  body: PasskeyLoginFinishBody,
): Promise<PasskeyLoginFinishResponse> {
  return request(
    'POST',
    '/auth/passkeys/login/finish',
    body,
    PasskeyLoginFinishResponseSchema,
  );
}
