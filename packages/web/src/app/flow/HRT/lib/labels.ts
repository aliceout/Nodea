/**
 * HRT display helpers — the typed enums resolved through the `hrt`
 * i18n namespace, plus small date formatters.
 *
 * Where it sits : the lib layer of the HRT module. The enum labels used
 * to live here as hardcoded FR `Record`s (the module's documented i18n
 * debt) ; since the i18n pass they are thin wrappers over `t('hrt.…')`,
 * with the FR / EN copy in `i18n/locales/{fr,en}/hrt.json`. The helpers
 * stay pure by taking the caller's `t` (from `useI18n()`) as their first
 * argument — no React, no context — so `export-model` & friends can
 * reuse them and tests can feed a locally-built translator.
 *
 * `markerLabel` is the exception : marker preset labels are shared DATA
 * (`@nodea/shared` presets, stored keys), not UI chrome — they are shown
 * verbatim, never translated.
 */
import {
  findMarker,
  type HrtCategory,
  type HrtDrawContext,
  type HrtFrequency,
  type HrtRoute,
} from '@nodea/shared';

/** The `t` shape the HRT module threads around — structurally
 *  compatible with the `useI18n()` provider function. */
export type HrtTranslate = (
  key: string,
  options?: { values?: Record<string, string | number> },
) => string;

/** Plural-aware `tn` — same threading contract as `HrtTranslate`. */
export type HrtTranslatePlural = (
  key: string,
  count: number,
  options?: { values?: Record<string, string | number> },
) => string;

/** Display label for a product category. */
export function categoryLabel(t: HrtTranslate, category: HrtCategory): string {
  return t(`hrt.category.${category}`);
}

/** Display label for an administration route. */
export function routeLabel(t: HrtTranslate, route: HrtRoute): string {
  return t(`hrt.route.${route}`);
}

/** Display label for a lab draw context. */
export function drawContextLabel(t: HrtTranslate, context: HrtDrawContext): string {
  return t(`hrt.drawContext.${context}`);
}

/** Display label for a marker key — preset label when known, else the
 *  raw key (free-text markers). */
export function markerLabel(key: string): string {
  return findMarker(key)?.label ?? key;
}

/** Human label for a schedule's cadence, e.g. « Tous les 5 jours ». */
export function frequencyLabel(
  t: HrtTranslate,
  frequency: HrtFrequency,
  everyNDays?: number,
): string {
  return frequency === 'every_n_days'
    ? t('hrt.frequency.everyNDays', { values: { n: everyNDays ?? '?' } })
    : t('hrt.frequency.daily');
}

/** Local-midnight ISO date `YYYY-MM-DD` for today. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Human label for a log row's date in the active locale, e.g.
 *  « 4 juin 2026 » / "4 June 2026". `locale` is `useI18n().language`. */
export function formatLogDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Compact numeric date for the PDF export, e.g. « 06.12.26 » (DD.MM.YY).
 *  The stored ISO is already zero-padded, so no reformatting is needed. */
export function formatDotDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y.slice(2)}`;
}
