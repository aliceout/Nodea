import { isApiError } from '@/core/api/client';

/** True when an API error came back with a 401 status —
 *  treated everywhere on this page as « mot de passe incorrect »
 *  (the only password-gated action that produces a 401 here is
 *  the freshen-password reauth that wraps every passkey
 *  mutation). */
export function isPasswordError(err: unknown): boolean {
  if (isApiError(err) && err.status === 401) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { status?: number }).status === 401
  );
}

/**
 * `navigator.credentials.create` rejects with `NotAllowedError`
 * when the user dismisses the prompt or the operation times
 * out (`AbortError` with some browsers). Surface a friendly
 * message instead of the raw error.
 */
export function isWebAuthnCancel(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}
