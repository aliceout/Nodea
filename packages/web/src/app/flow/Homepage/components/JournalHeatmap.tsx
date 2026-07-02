import { useMemo } from 'react';

import { formatLongDate, getMonthNames } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useMediaQuery } from '@/lib/use-media-query';
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
import HomeModuleLink from './HomeModuleLink';

// 6 months (26 weeks) on desktop ; 4 months (17 weeks) below `lg`,
// where 26 columns of 1fr squares get too small to read / tap.
const WEEKS_DESKTOP = 26;
const WEEKS_MOBILE = 17;
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
  const { t, tn, language } = useI18n();
  const { journal } = useHomepageData();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weeks = isDesktop ? WEEKS_DESKTOP : WEEKS_MOBILE;
  const months = isDesktop ? 6 : 4;

  const byDay = useMemo(() => aggregateByDay(journal), [journal]);

  const { cells, monthLabels, writtenCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const endDow = (today.getDay() + 6) % 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - endDow);
    const oldestMonday = new Date(thisMonday);
    oldestMonday.setDate(thisMonday.getDate() - (weeks - 1) * 7);

    const cellsOut: Array<HeatmapCellInput | null> = [];
    let written = 0;
    for (let i = 0; i < weeks * DAYS_PER_WEEK; i++) {
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

    const monthNames = getMonthNames(language, 'short');
    const labels: HeatmapMonthLabel[] = [];
    let prevMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const monday = new Date(oldestMonday);
      monday.setDate(oldestMonday.getDate() + w * 7);
      if (monday.getMonth() !== prevMonth) {
        labels.push({ weekIndex: w, label: monthNames[monday.getMonth()]! });
        prevMonth = monday.getMonth();
      }
    }

    return { cells: cellsOut, monthLabels: labels, writtenCount: written };
  }, [byDay, language, t, weeks]);

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
      title={t('home.journal.eyebrow', { values: { months } })}
      trailing={
        <span className="tabular-nums">
          {tn('home.journal.daysWritten', writtenCount, {
            values: { count: writtenCount },
          })}
        </span>
      }
      cta={<HomeModuleLink module="journal" label={t('home.viewAll')} />}
    >
      <Heatmap
        weeks={weeks}
        cells={cells}
        monthLabels={monthLabels}
        dayLabels={dayLabels}
        ariaLabel={t('home.journalStrip.ariaLabel')}
      />
    </HomeCard>
  );
}
