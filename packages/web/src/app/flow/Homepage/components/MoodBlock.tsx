import { useMemo } from 'react';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useMediaQuery } from '@/lib/use-media-query';
import Heatmap, { type HeatmapCellInput } from '@/ui/dirk/Heatmap';

import { buildHeatmap } from '../../Mood/lib/heatmap';

// 6 months (26 weeks) on desktop ; 4 months (17 weeks) below `lg`,
// where 26 columns of 1fr squares get too small to read / tap.
const WEEKS_DESKTOP = 26;
const WEEKS_MOBILE = 17;

import { useHomepageData } from '../context';
import { MOOD_BLOCK_FILL } from '../lib/constants';
import { formatMoodAvg } from '../lib/format';
import HomeCard from './HomeCard';

/**
 * Mood section on the Homepage — 52-week GitHub-style frise over
 * a rolling year, reusing the shared `ui/dirk/Heatmap` component
 * and Mood's own `buildHeatmap` so the home and the Mood page
 * stay visually aligned. No legend on the home (the score key
 * lives on the Mood page itself).
 *
 * The trailing summary surfaces the average across all loaded
 * Mood entries — informative on a year window in a way the
 * previous 14-day strip wasn't.
 */
export default function MoodBlock() {
  const { t } = useI18n();
  const { mood } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weeks = isDesktop ? WEEKS_DESKTOP : WEEKS_MOBILE;
  const months = isDesktop ? 6 : 4;

  const { cells, monthLabels } = useMemo(
    () => buildHeatmap(null, mood, new Date(), weeks),
    [mood, weeks],
  );

  const heatmapCells = useMemo<Array<HeatmapCellInput | null>>(
    () =>
      cells.map((cell) => {
        if (cell === null) return null;
        const signed = Number(cell.score) > 0 ? `+${cell.score}` : cell.score;
        return {
          className: MOOD_BLOCK_FILL[cell.score],
          isToday: cell.isToday,
          title: `${cell.dateLabel} · ${signed}`,
        };
      }),
    [cells],
  );

  const avg = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const cell of cells) {
      if (cell === null) continue;
      sum += Number(cell.score);
      count++;
    }
    return count === 0 ? null : sum / count;
  }, [cells]);

  const dayLabels = [
    t('mood.chart.day0'),
    t('mood.chart.day1'),
    t('mood.chart.day2'),
    t('mood.chart.day3'),
    t('mood.chart.day4'),
    t('mood.chart.day5'),
    t('mood.chart.day6'),
  ];

  return (
    <HomeCard
      title={t('home.mood.eyebrow', { values: { months } })}
      trailing={
        avg !== null ? (
          <span className="tabular-nums">
            {t('home.mood.average', { values: { avg: formatMoodAvg(avg) } })}
          </span>
        ) : (
          <span className="italic">{t('home.mood.empty')}</span>
        )
      }
      cta={
        <button
          type="button"
          onClick={() => setModule('mood')}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {t('home.viewAll')} →
        </button>
      }
    >
      <Heatmap
        weeks={weeks}
        cells={heatmapCells}
        monthLabels={monthLabels}
        dayLabels={dayLabels}
      />
    </HomeCard>
  );
}
