import { useMemo, type ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useMoodData } from '../context';
import {
  computeAverage30d,
  computePatterns,
  formatMoodAvg,
} from '../lib/stats';
import ScoreDonut from './ScoreDonut';

/**
 * Mood sidebar — score distribution donut on top, observations
 * (« Patterns ») below.
 *
 * Patterns are computed over `{date, score}` only — no external
 * signals (sleep, calendar, weather…) because the app doesn't
 * capture them ; surfacing fake correlations would undermine
 * trust.
 *
 * Three signals, each surfaced only when the data supports it :
 *  - best / worst day of the week (mean score per weekday vs the
 *    overall mean, requires ≥ 3 entries on the day to dampen
 *    one-shot noise).
 *  - longest non-negative streak — counts consecutive entries
 *    (not calendar days), so a missed day doesn't break the
 *    streak.
 *  - 30-day rolling mean vs 90-day rolling mean, only shown when
 *    the gap is meaningful (≥ 0.2 on the −2..+2 scale).
 *
 * The donut + Patterns block both read the *full* entry list, so
 * the year / month filters do not change what's shown here — the
 * sidebar is a lifetime view by design.
 */
export default function SideColumn() {
  const { t, language } = useI18n();
  const { entries, today } = useMoodData();
  const patterns = useMemo(
    () => computePatterns(entries, today, language),
    [entries, today, language],
  );
  // 30-day rolling mean — used to be displayed in the page
  // subtitle ; now lives in the Patterns block as a permanent
  // first row so the header surface stays uncluttered.
  const avg30d = useMemo(
    () => computeAverage30d(entries, today),
    [entries, today],
  );

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>{t('mood.side.distribution')}</SectionLabel>
        <ScoreDonut />
      </section>

      <section>
        <SectionLabel>{t('mood.side.patterns')}</SectionLabel>
        <ul>
          <li className="border-b border-hair py-2.5">
            <div className="text-[13px] font-medium text-ink">
              {t('mood.side.rollingAvg')}{' '}
              <span className="tabular-nums">{formatMoodAvg(avg30d)}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {t('mood.side.rollingAvgScale')}
            </div>
          </li>
          {patterns.length === 0 ? (
            <li className="border-b border-hair py-2.5 last:border-b-0 text-[12px] italic text-muted">
              {t('mood.side.noPatterns')}
            </li>
          ) : (
            patterns.map((p) => (
              <li
                key={p.label}
                className="border-b border-hair py-2.5 last:border-b-0"
              >
                <div className="text-[13px] font-medium text-ink">{p.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">{p.delta}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
