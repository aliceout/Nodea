import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './error-message.ts';
import type { ApiError } from './internal.ts';

/**
 * The translator's contract :
 *
 *   1. Known code  → `errors.api.<code>` looked up.
 *   2. Unknown code on an `ApiError` shape → `errors.api.unknown`.
 *   3. Anything else (raw fetch error, undefined, plain string)
 *      → `errors.api.network`.
 *
 * The test fakes the `t()` function with a tiny in-memory dictionary
 * + a captured-keys log so we can assert which i18n key was picked
 * regardless of language.
 */

interface CapturedT {
  fn: (key: string, options?: { defaultValue?: string }) => string;
  keys: string[];
}

function makeT(table: Record<string, string>): CapturedT {
  const keys: string[] = [];
  const fn = (
    key: string,
    options?: { defaultValue?: string },
  ): string => {
    keys.push(key);
    return table[key] ?? options?.defaultValue ?? key;
  };
  return { fn, keys };
}

describe('apiErrorMessage', () => {
  it('translates a known ApiError code via errors.api.<code>', () => {
    const err: ApiError = { status: 401, error: 'invalid_credentials' };
    const t = makeT({ 'errors.api.invalid_credentials': 'Wrong password.' });
    expect(apiErrorMessage(err, t.fn)).toBe('Wrong password.');
    // The helper looks up both `unknown` (eagerly, as defaultValue)
    // and the actual code — JS evaluates fn args left-to-right, so
    // we just assert presence rather than position.
    expect(t.keys).toContain('errors.api.invalid_credentials');
  });

  it('falls back to errors.api.unknown when the code lookup misses', () => {
    const err: ApiError = { status: 500, error: 'invalid_credentials' };
    const t = makeT({
      // The code is known but the JSON entry is missing.
      'errors.api.unknown': 'Unexpected error.',
    });
    expect(apiErrorMessage(err, t.fn)).toBe('Unexpected error.');
  });

  it('falls back to errors.api.unknown for codes the front does not recognise', () => {
    // A code the API ships that the canonical KNOWN_API_ERROR_CODES
    // list hasn't been updated to include yet.
    const err: ApiError = { status: 400, error: 'a_freshly_minted_code' };
    const t = makeT({ 'errors.api.unknown': 'Unexpected error.' });
    expect(apiErrorMessage(err, t.fn)).toBe('Unexpected error.');
    // Should NOT have looked up `errors.api.a_freshly_minted_code`
    // — that would create silent gaps in the FR/EN parity tests.
    expect(t.keys).not.toContain('errors.api.a_freshly_minted_code');
  });

  it('falls back to errors.api.network when the catch fired on a non-ApiError', () => {
    // Real-world: fetch threw, JSON parse threw, something else
    // entirely. We get a generic « connection » message.
    const t = makeT({ 'errors.api.network': 'Cannot reach the server.' });
    expect(apiErrorMessage(new TypeError('Failed to fetch'), t.fn)).toBe(
      'Cannot reach the server.',
    );
    expect(apiErrorMessage(undefined, t.fn)).toBe('Cannot reach the server.');
    expect(apiErrorMessage('a plain string', t.fn)).toBe(
      'Cannot reach the server.',
    );
    expect(apiErrorMessage(null, t.fn)).toBe('Cannot reach the server.');
  });

  it('uses the inline French defaultValue when no translation table is provided', () => {
    // Worst-case fallback: even errors.json is empty for the chosen
    // language. The hard-coded FR `defaultValue` ships so the user
    // sees something, not the raw key.
    const err: ApiError = { status: 401, error: 'invalid_credentials' };
    const t = makeT({});
    const out = apiErrorMessage(err, t.fn);
    expect(out).toBe('Une erreur inattendue est survenue.');
  });
});
