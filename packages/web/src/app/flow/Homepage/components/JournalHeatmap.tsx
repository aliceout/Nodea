import { useMemo } from 'react';

import { formatLongDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, {
  type HeatmapCellInput,
  type HeatmapMonthLabel,
} from '@/ui/dirk/Heatmap';

import {
  aggregateByDay,
  densityToIntensity,
  type DayDensity,
} from '@/app/flow/Journal/lib/day-density';
import { isoDay } from '@/app/flow/Journal/lib/stats';

import { useHomepageData } from '../context';
import HomeCard from './HomeCard';

const WEEKS = 26;
const DAYS_PER_WEEK = 7;

/**
 * Journal writing-density section on the Homepage — 52-week
 * rolling heatmap mirroring `Journal/views/Chart.tsx`. Reuses the
 * shared `ui/dirk/Heatmap` so this card and the Journal page
 * itself surface the same visual surface ; the cells are coloured
 * by the day's word-count bucket (`--heatmap-bucket-N`).
 *
 * The 30-day strip this block used to render was too short to
 * read as anything beyond « did you write this week ». The
 * year view restores a sense of cycle (writing seasons, gaps,
 * streaks) without needing the user to leave the homepage.
 */
export default function JournalHeatmap() {
  const { t, language } = useI18n();
  const { journal } = useHomepageData();
  const setModule = useNodeaStore((s) => s.setModule);

  const byDay = useMemo(() => aggregateByDay(journal), [journal]);

  const { cells, monthLabels, writtenCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const endDow = (today.getDay() + 6) % 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - endDow);
    const oldestMonday = new Date(thisMonday);
    oldestMonday.setDate(thisMonday.getDate() - (WEEKS - 1) * 7);

    const cellsOut: Array<HeatmapCellInput | null> = [];
    let written = 0;
    for (let i = 0; i < WEEKS * DAYS_PER_WEEK; i++) {
      const cellDate = new Date(oldestMonday);
      cellDate.setDate(oldestMonday.getDate() + i);
      const cellTime = cellDate.getTime();
      if (cellTime > todayTime) {
        cellsOut.push(null);
        continue;
      }
      const iso = isoDay(cellDate);
      const density: DayDensity | undefined = byDay.get(iso);
      if (!density) {
        cellsOut.push(null);
        continue;
      }
      written++;
      const bucket = densityToIntensity(density);
      const label = formatLongDate(iso, language);
      cellsOut.push({
        fill: `var(--heatmap-bucket-${bucket})`,
        isToday: cellTime === todayTime,
        title: t('journal.heatmap.tooltip', {
          values: { date: label, count: density.count, words: density.words },
        }),
      });
    }

    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const labels: HeatmapMonthLabel[] = [];
    let prevMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
      const monday = new Date(oldestMonday);
      monday.setDate(oldestMonday.getDate() + w * 7);
      if (monday.getMonth() !== prevMonth) {
        labels.push({ weekIndex: w, label: monthFormatter.format(monday) });
        prevMonth = monday.getMonth();
      }
    }

    return { cells: cellsOut, monthLabels: labels, writtenCount: written };
  }, [byDay, language, t]);

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
      title="ÉCRITURE · 6 MOIS"
      trailing={
        <span className="tabular-nums">
          {writtenCount} {writtenCount === 1 ? 'jour' : 'jours'}
        </span>
      }
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
      <Heatmap
        weeks={WEEKS}
        cells={cells}
        monthLabels={monthLabels}
        dayLabels={dayLabels}
        ariaLabel={t('home.journalStrip.ariaLabel')}
      />
    </HomeCard>
  );
}
