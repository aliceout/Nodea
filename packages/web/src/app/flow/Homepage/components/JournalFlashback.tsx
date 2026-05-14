import { useMemo } from 'react';

import { formatLongDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';

const TARGET_DAYS_AGO = 365;
const NEAR_WINDOW_DAYS = 45;
const PICK_COUNT = 3;
const SNIPPET_CHARS = 110;

/**
 * « Moments d'il y a un an » — three journal entries closest to
 * today minus one year, so the homepage carries a sense of where
 * you stood back then. When the dataset doesn't reach that far
 * yet, falls back to the three oldest entries on file — the
 * eyebrow shifts to « TES DÉBUTS » so the user reads the change
 * instead of seeing « il y a un an » next to recent dates.
 *
 * Each row mirrors the Hero's typographic pattern : a small
 * uppercase eyebrow with date + thread, then either the title
 * (serif) or the first sentence of the body (sans, muted) as a
 * teaser. Clicking a row jumps to the Journal module.
 *
 * Hides entirely on an empty journal.
 */
export default function JournalFlashback() {
  const { language } = useI18n();
  const { journal } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);

  const { picks, isFallback } = useMemo(() => {
    if (journal.length === 0) return { picks: [], isFallback: false };

    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() - TARGET_DAYS_AGO);
    const targetTime = target.getTime();
    const windowMs = NEAR_WINDOW_DAYS * 86_400_000;

    const dated = journal
      .map((entry) => {
        const t = Date.parse(entry.dateIso);
        return Number.isFinite(t) ? { entry, t } : null;
      })
      .filter(
        (x): x is { entry: typeof journal[number]; t: number } => x !== null,
      );

    const nearTarget = dated
      .filter((x) => Math.abs(x.t - targetTime) <= windowMs)
      .sort((a, b) => Math.abs(a.t - targetTime) - Math.abs(b.t - targetTime));

    if (nearTarget.length > 0) {
      return {
        picks: nearTarget.slice(0, PICK_COUNT).map((x) => x.entry),
        isFallback: false,
      };
    }

    const oldest = [...dated].sort((a, b) => a.t - b.t);
    return {
      picks: oldest.slice(0, PICK_COUNT).map((x) => x.entry),
      isFallback: true,
    };
  }, [journal]);

  if (picks.length === 0) return null;

  return (
    <HomeCard
      title={isFallback ? 'MOMENTS · TES DÉBUTS' : 'MOMENTS · IL Y A UN AN'}
      cta={
        <button
          type="button"
          onClick={() => setModule('journal')}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      }
    >
      <ul className="space-y-4">
        {picks.map((entry) => {
          const title = entry.title?.trim() ?? '';
          const snippet = entry.content.trim().replace(/\s+/g, ' ');
          const teaser =
            snippet.length > SNIPPET_CHARS
              ? `${snippet.slice(0, SNIPPET_CHARS).trim()}…`
              : snippet;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setModule('journal')}
                className="group block w-full cursor-pointer text-left"
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
                  <span>{formatLongDate(entry.dateIso, language)}</span>
                  {entry.thread.length > 0 ? (
                    <>
                      <span aria-hidden="true" className="mx-2">·</span>
                      <span>{entry.thread}</span>
                    </>
                  ) : null}
                </p>
                {title.length > 0 ? (
                  <p className="mt-1 truncate font-serif text-[15px] leading-[1.3] text-ink transition-colors group-hover:text-accent">
                    {title}
                  </p>
                ) : teaser.length > 0 ? (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[1.55] text-ink-soft transition-colors group-hover:text-accent">
                    {teaser}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}
