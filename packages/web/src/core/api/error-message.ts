/**
 * Cross-page translator for API error responses.
 *
 * Replaces the per-page tables of `switch (err.error) { … }` that
 * each surface (Login, Register, Recover, Account/*) used to ship
 * inline. Look up the code in the `errors` i18n namespace, fall
 * back to a generic « unexpected error » entry when the code isn't
 * known.
 *
 * Reference : `docs/roadmap/health.md` Tier B.4 +
 * `docs/Internationalisation.md` § « Codes erreur API ».
 */

import { isKnownApiErrorCode } from '@nodea/shared';
import type { ApiError } from './internal.ts';

export type TranslateFn = (
  key: string,
  options?: { defaultValue?: string; values?: Record<string, unknown> },
) => string;

/**
 * Return the i18n string for an API error. Pattern :
 *
 *   - if `value` is an `ApiError` (typed `{ status, error, reason? }`),
 *     look up `errors.api.<code>` ;
 *   - if the code isn't registered (or the JSON entry is missing)
 *     fall back to `errors.api.unknown` ;
 *   - if the catch threw something else entirely (non-`ApiError`),
 *     fall back to `errors.api.network`.
 *
 * The fallback `defaultValue` strings keep the surface alive even
 * when `errors.json` lags : a brand-new code surfaces as the same
 * generic copy as a network blip until i18n catches up.
 */
export function apiErrorMessage(value: unknown, t: TranslateFn): string {
  if (isApiErrorLike(value)) {
    const code = value.error;
    if (isKnownApiErrorCode(code)) {
      return t(`errors.api.${code}`, {
        defaultValue: t('errors.api.unknown', {
          defaultValue: 'Une erreur inattendue est survenue.',
        }),
      });
    }
    return t('errors.api.unknown', {
      defaultValue: 'Une erreur inattendue est survenue.',
    });
  }
  return t('errors.api.network', {
    defaultValue: 'Connexion impossible. Réessaie dans un instant.',
  });
}

function isApiErrorLike(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  );
}
