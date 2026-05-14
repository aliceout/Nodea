import { useMemo } from 'react';

import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import {
  aggregateByDay,
  densityToIntensity,
  type DayDensity,
} from '@/app/flow/Journal/lib/day-density';
import { isoDay } from '@/app/flow/Journal/lib/stats';

import { useHomepageData } from '../context';
import SectionLabel from './SectionLabel';

const STRIP_DAYS = 30;

/**
 * Homepage Journal block — « 30 derniers jours » strip.
 *
 * The full 52-week heatmap lives on the Journal page itself
 * (collapsed by default behind a « Voir la carte d'écriture »
 * toggle). On the homepage we surface just the recent past so the
 * block stays in the « short term » register of the other home
 * blocks (À voir today, in-progress reading, recent journal).
 *
 * Layout : 30 equal-width cells in a single row, oldest on the
 * left, today on the right with an accent ring. Days without an
 * entry render as faint outlines so the strip stays scannable
 * without faking data. Hover surfaces a native tooltip with the
 * date + word count.
 *
 * Reads journal entries from the Homepage data context (lifted in
 * `HomepageProvider` so `ToSeeList` / `RecentJournal` / this strip
 * all share the same fetch).
 */
export default function JournalHeatmap() {
  const { t, language } = useI18n();
  const { journal } = useHomepageData();

  const byDay = useMemo(() => aggregateByDay(journal), [journal]);

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const out: Array<{
      iso: string;
      bucket: number;
      isToday: boolean;
      title: string;
    } | null> = [];
    for (let i = STRIP_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = isoDay(d);
      const density: DayDensity | undefined = byDay.get(iso);
      const label = formatLongDate(iso, language);
      if (!density) {
        out.push(null);
        // We still want the tooltip on empty days — push a
        // « tooltip-only » cell with bucket 0 so the user can
        // hover any day and see « rien écrit ce jour ».
        // (Done via the parallel `meta` array below.)
        continue;
      }
      out.push({
        iso,
        bucket: densityToIntensity(density),
        isToday: d.getTime() === todayTime,
        title: t('journal.heatmap.tooltip', {
          values: { date: label, count: density.count, words: density.words },
        }),
      });
    }
    return out;
  }, [byDay, language, t]);

  // Parallel array : ISO + empty-day tooltip for cells the main
  // loop pushed as `null` (no density). Kept separate so the main
  // cell list stays a clean « has data | doesn't have data »
  // discriminator.
  const emptyMeta = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const out: Array<{ iso: string; isToday: boolean; title: string }> = [];
    for (let i = STRIP_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = isoDay(d);
      out.push({
        iso,
        isToday: d.getTime() === todayTime,
        title: t('journal.heatmap.tooltipEmpty', {
          values: { date: formatLongDate(iso, language) },
        }),
      });
    }
    return out;
  }, [language, t]);

  // Hide the block on a brand-new journal — both the strip and
  // the « Journal récent » block would be empty placeholders.
  if (journal.length === 0) return null;

  return (
    <div className="mt-7">
      <SectionLabel>{t('home.journalStrip.heading')}</SectionLabel>
      <div
        role="img"
        aria-label={t('home.journalStrip.ariaLabel')}
        className="mt-1 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${STRIP_DAYS}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, i) => {
          const empty = emptyMeta[i]!;
          if (cell === null) {
            return (
              <span
                key={empty.iso}
                title={empty.title}
                className={cn(
                  'aspect-square rounded-[3px] border border-hair/70',
                  empty.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
                )}
              />
            );
          }
          return (
            <span
              key={cell.iso}
              title={cell.title}
              style={{ backgroundColor: `var(--heatmap-bucket-${cell.bucket})` }}
              className={cn(
                'aspect-square rounded-[3px]',
                cell.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
