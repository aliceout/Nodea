/**
 * Pure translation helpers used by `I18nProvider.jsx`. Lifted out
 * of the provider so the tests don't need a React tree to assert
 * resolution behaviour (default value, fallback chain, plural rule
 * pick).
 *
 * No React, no DOM — these are simple lookup + interpolation
 * functions over a `RESOURCES` map keyed by language → namespace →
 * dotted path. Pass them whatever you want : in-tests we feed a
 * tiny dictionary, in-app the provider feeds the bundled JSON.
 */

const SENTINEL = '__nodea_i18n_missing__';

export type Resources = Record<string, Record<string, unknown>>;

export interface TranslateOptions {
  /** Language to fall back on when `language` lacks the entry.
   *  Defaults to `"fr"` (the project's default locale). */
  fallback?: string;
  /** Interpolation values for `{token}` placeholders. */
  values?: Record<string, unknown>;
  /** Returned when both `language` and `fallback` lack the entry.
   *  Defaults to the key itself. */
  defaultValue?: string;
}

function resolvePath(resource: unknown, segments: ReadonlyArray<string>): unknown {
  return segments.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, resource);
}

function applyInterpolation(
  message: unknown,
  values: Record<string, unknown> | undefined,
): unknown {
  if (typeof message !== 'string' || !values) return message;
  return message.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = values[token.trim()];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Resolve `key` in `resources` for `language`, falling back to
 * `fallback` (default `"fr"`) when missing. Returns `defaultValue`
 * (or the key itself) when neither side carries the entry.
 */
export function translate(
  resources: Resources,
  language: string,
  key: string,
  options: TranslateOptions = {},
): string {
  const { fallback = 'fr', values, defaultValue } = options;
  const segments = String(key).split('.').filter(Boolean);
  if (!segments.length) {
    return typeof defaultValue === 'string' ? defaultValue : key;
  }

  const namespace = segments[0]!;
  const path = segments.slice(1);
  const resource = resources[language]?.[namespace];
  let message: unknown =
    resource !== undefined ? resolvePath(resource, path) : undefined;

  if (message === undefined && fallback && fallback !== language) {
    const fallbackResource = resources[fallback]?.[namespace];
    message =
      fallbackResource !== undefined
        ? resolvePath(fallbackResource, path)
        : undefined;
  }

  if (message === undefined) {
    return typeof defaultValue === 'string' ? defaultValue : key;
  }

  const interpolated = applyInterpolation(message, values);
  return typeof interpolated === 'string' ? interpolated : String(interpolated);
}

/**
 * Plural-aware translate. Picks `<key>.<rule>` where `<rule>` is
 * the result of `Intl.PluralRules(language).select(count)` —
 * one of `zero | one | two | few | many | other`.
 *
 * Resolution order :
 *   1. `<key>.<exact-rule>` (e.g. `key.one`, `key.few`)
 *   2. `<key>.other` (the universal fallback)
 *   3. `<key>` itself if it's a plain string
 *   4. `defaultValue` from options, else the key string
 *
 * `count` is automatically injected into `values.count` ; an
 * explicit `count` in `values` overrides.
 */
export function translatePlural(
  resources: Resources,
  language: string,
  key: string,
  count: number,
  options: TranslateOptions = {},
): string {
  const { fallback = 'fr', values, defaultValue } = options;
  const merged: Record<string, unknown> = { count, ...(values ?? {}) };

  const rule = (() => {
    try {
      return new Intl.PluralRules(language).select(count);
    } catch {
      return 'other';
    }
  })();

  const ruleKey = `${key}.${rule}`;
  const direct = translate(resources, language, ruleKey, {
    fallback,
    values: merged,
    defaultValue: SENTINEL,
  });
  if (direct !== SENTINEL) return direct;

  if (rule !== 'other') {
    const otherKey = `${key}.other`;
    const otherMsg = translate(resources, language, otherKey, {
      fallback,
      values: merged,
      defaultValue: SENTINEL,
    });
    if (otherMsg !== SENTINEL) return otherMsg;
  }

  // Plain-string fallback at the bare key (caller wrote
  // `key: "{count} thing"` without splitting).
  const flat = translate(resources, language, key, {
    fallback,
    values: merged,
    defaultValue: SENTINEL,
  });
  if (flat !== SENTINEL) return flat;

  return typeof defaultValue === 'string' ? defaultValue : key;
}
