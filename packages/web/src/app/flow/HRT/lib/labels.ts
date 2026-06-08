/**
 * HRT display labels — FR strings for the typed enums + a tiny date
 * helper. Kept inline (no i18n namespace yet) to match Library's
 * pattern; a dedicated `hrt.json` can come later if the module grows
 * an EN audience.
 */
import {
  findMarker,
  type HrtCategory,
  type HrtDrawContext,
  type HrtFrequency,
  type HrtRoute,
} from '@nodea/shared';

export const HRT_CATEGORY_LABELS: Record<HrtCategory, string> = {
  estrogen: 'Œstrogène',
  antiandrogen: 'Anti-androgène',
  progestogen: 'Progestatif',
  testosterone: 'Testostérone',
  gnrh: 'Agoniste GnRH',
  other: 'Autre',
};

export const HRT_ROUTE_LABELS: Record<HrtRoute, string> = {
  oral: 'Orale',
  sublingual: 'Sublinguale',
  injection_im: 'Injection IM',
  injection_sc: 'Injection SC',
  gel: 'Gel',
  patch: 'Patch',
  spray: 'Spray',
  implant: 'Implant',
  other: 'Autre',
};

export const HRT_DRAW_CONTEXT_LABELS: Record<HrtDrawContext, string> = {
  trough: 'Creux',
  peak: 'Pic',
  random: 'Aléatoire',
  unknown: 'Non précisé',
};

/** Display label for a marker key — preset label when known, else the
 *  raw key (free-text markers). */
export function markerLabel(key: string): string {
  return findMarker(key)?.label ?? key;
}

/** Human label for a schedule's cadence, e.g. « Tous les 5 jours ». */
export function frequencyLabel(frequency: HrtFrequency, everyNDays?: number): string {
  return frequency === 'every_n_days' ? `Tous les ${everyNDays ?? '?'} jours` : 'Tous les jours';
}

/** Local-midnight ISO date `YYYY-MM-DD` for today. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Human label for a log row's date, e.g. « 4 juin 2026 ». */
export function formatLogDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
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
