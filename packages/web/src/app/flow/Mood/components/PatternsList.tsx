import { useCallback, useMemo } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';

import { useMoodData } from '../context';
import {
  computeAverage30d,
  computePatterns,
  formatMoodAvg,
  type StatsTranslate,
} from '../lib/stats';

/**
 * Mood « Patterns » list — the 30-day rolling mean (always shown as the
 * first row) followed by whatever observations the data supports
 * (best/worst weekday, longest non-negative streak, 30d-vs-90d trend).
 * Extracted from `SideColumn` (REFACTO-08) so the side column is pure
 * layout and the stats computation lives with its own render.
 *
 * Reads the *full* entry list (the lifetime view) — the year / month
 * filters do not change what's shown here, by design. Patterns are
 * computed over `{date, score}` only; no fake external correlations.
 */
export default function PatternsList() {
  const { t, language } = useI18n();
  const { entries, today } = useMoodData();

  // Adapter from the provider's `t(key, { values })` shape to the pure
  // lib's `(key, values)` contract — `lib/stats` stays React-free.
  const statsT = useCallback<StatsTranslate>(
    (key, values) => (values ? t(key, { values }) : t(key)),
    [t],
  );
  const patterns = useMemo(
    () => computePatterns(entries, statsT, today, language),
    [entries, statsT, today, language],
  );
  const avg30d = useMemo(
    () => computeAverage30d(entries, today),
    [entries, today],
  );

  return (
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
  );
}
