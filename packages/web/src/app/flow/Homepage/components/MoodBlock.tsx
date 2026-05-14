import { useMemo } from 'react';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, { type HeatmapCellInput } from '@/ui/dirk/Heatmap';

import { buildHeatmap } from '../../Mood/lib/heatmap';

const HOME_WEEKS = 26;

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

  const { cells, monthLabels } = useMemo(
    () => buildHeatmap(null, mood, new Date(), HOME_WEEKS),
    [mood],
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
      title="MOOD · 6 MOIS"
      trailing={
        avg !== null ? (
          <span className="tabular-nums">moyenne {formatMoodAvg(avg)}</span>
        ) : (
          <span className="italic">aucune entrée</span>
        )
      }
      cta={
        <button
          type="button"
          onClick={() => setModule('mood')}
          className="cursor-pointer underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      }
    >
      <Heatmap
        weeks={HOME_WEEKS}
        cells={heatmapCells}
        monthLabels={monthLabels}
        dayLabels={dayLabels}
      />
    </HomeCard>
  );
}
