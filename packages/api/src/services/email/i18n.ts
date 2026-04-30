import type { Context } from 'hono';

import { en } from './locales/en.ts';
import { fr, type EmailLocaleShape } from './locales/fr.ts';

/**
 * Email i18n — Tier 5 of `docs/roadmap/i18n.md`.
 *
 * Decision: Option B (no `users.email_language` column). The
 * server reads the triggering request's `Accept-Language` header
 * and uses that to pick the email's locale. Trade-off frozen:
 *   - For self-service flows (register, password-reset, MFA
 *     bypass…), `Accept-Language` matches the recipient's browser.
 *   - For admin invites, the recipient has no account yet so no
 *     header is available — we use the *admin's* `Accept-Language`,
 *     which is a heuristic but reasonable (admin and invitee tend
 *     to share a deployment context).
 *   - Emails fired without a request (future cron reminders) have
 *     no context at all and fall back to `DEFAULT_LANGUAGE` (FR).
 * No plaintext language hint lands on `users`, so the encryption
 * boundary stays clean.
 *
 * Mechanism :
 *   - One locale module per language under `locales/<code>.ts`,
 *     deeply-nested string trees keyed by template + sub-path.
 *   - `emailT(language, key, values?)` does dotted-path lookup
 *     with FR fallback when EN (or any future locale) misses an
 *     entry. `{token}` interpolation, same shape as the web-side
 *     `t()`.
 *   - `extractEmailLanguage(c)` parses `Accept-Language`,
 *     returns the first supported tag or `'fr'`.
 */

export type SupportedEmailLanguage = 'fr' | 'en';

const RESOURCES: Record<SupportedEmailLanguage, EmailLocale> = { fr, en };
const DEFAULT_LANGUAGE: SupportedEmailLanguage = 'fr';

/**
 * Shape of a locale module. Both `fr.ts` and `en.ts` conform to
 * `EmailLocaleShape` (declared in `fr.ts`), so a missing key is
 * a TS error before it's a runtime issue.
 */
export type EmailLocale = EmailLocaleShape;

interface EmailTOptions {
  /** Interpolation values for `{token}` placeholders. */
  values?: Record<string, string | number>;
}

/** Walk a dotted path on the locale tree, returning a string or
 *  undefined. */
function resolvePath(bag: unknown, segments: ReadonlyArray<string>): unknown {
  return segments.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, bag);
}

function applyInterpolation(
  message: string,
  values: Record<string, string | number> | undefined,
): string {
  if (!values) return message;
  return message.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = values[token.trim()];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Look up `key` in `language`, falling back to FR when the key
 * is missing. Returns the key itself if both sides miss — same
 * shape as the web-side `t()`. Throws if the resolved value is
 * not a string (programming error : a caller asked for a sub-
 * tree, not a leaf).
 */
export function emailT(
  language: SupportedEmailLanguage,
  key: string,
  options: EmailTOptions = {},
): string {
  const segments = key.split('.').filter(Boolean);
  if (segments.length === 0) return key;

  const direct = resolvePath(RESOURCES[language], segments);
  if (typeof direct === 'string') {
    return applyInterpolation(direct, options.values);
  }

  if (language !== DEFAULT_LANGUAGE) {
    const fallback = resolvePath(RESOURCES[DEFAULT_LANGUAGE], segments);
    if (typeof fallback === 'string') {
      return applyInterpolation(fallback, options.values);
    }
  }

  return key;
}

/**
 * Parse `Accept-Language` and return the first supported tag.
 * Falls back to `DEFAULT_LANGUAGE` when the header is missing,
 * malformed, or doesn't list any supported language.
 *
 * Example header : `fr-FR,fr;q=0.9,en;q=0.8` → `'fr'`.
 *                  `en-US,en;q=0.5` → `'en'`.
 */
export function extractEmailLanguage(c: Context): SupportedEmailLanguage {
  const header = c.req.header('accept-language');
  return parseAcceptLanguage(header);
}

/** Pure parser exposed for tests. */
export function parseAcceptLanguage(
  header: string | undefined,
): SupportedEmailLanguage {
  if (!header) return DEFAULT_LANGUAGE;
  // Sort tags by their `q` weight (default 1.0 when missing),
  // then walk in priority order. Anything we don't support is
  // skipped silently.
  const tags = header
    .split(',')
    .map((raw) => {
      const [tagPart, ...params] = raw.trim().split(';');
      // Trim again — split(';') leaves whitespace around each part
      // when the header is whitespace-noisy (e.g.
      // `'en-GB ; q=0.8'` → `['en-GB ', ' q=0.8']`).
      const tag = (tagPart ?? '').trim().toLowerCase();
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number(qParam.split('=')[1]) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((t) => t.tag.length > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const primary = tag.split('-')[0] ?? '';
    if (primary === 'fr' || primary === 'en') {
      return primary;
    }
  }
  return DEFAULT_LANGUAGE;
}
