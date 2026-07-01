/**
 * Cycle heatmap view — the GitHub-contributions frise (spec §6, 4th
 * view). Same posture as the Mood / Journal frise : the shared
 * `ui/dirk/Heatmap` grid rendered twice — a full rolling year at `md+`
 * and a 17-week compact grid below `md` (a 52-column year renders ~5 px
 * cells on a phone and the month labels overlap). Flow days are shaded
 * on the warm « low » ramp ; clicking a day opens its form.
 */
import { useMemo } from 'react';
import type { CycleFlow } from '@nodea/shared';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, { type HeatmapCellInput } from '@/ui/dirk/Heatmap';
import {
  buildCycleHeatmap,
  CYCLE_HEATMAP_COMPACT_WEEKS,
  CYCLE_HEATMAP_WEEKS,
  type CycleHeatCell,
} from '../lib/heatmap';

/** Flow intensity → warm « low » ramp (3 buckets, GitHub-style). */
const FLOW_FILL: Record<CycleFlow, string> = {
  spotting: 'bg-low-soft',
  light: 'bg-low-soft',
  medium: 'bg-low',
  heavy: 'bg-low-deep',
};

interface Props {
  flowByDate: ReadonlyMap<string, CycleFlow>;
  today: string;
  onSelectDay: (iso: string) => void;
}

export default function CycleHeatmap({ flowByDate, today, onSelectDay }: Props) {
  const { t, language } = useI18n();

  const full = useMemo(
    () => buildCycleHeatmap(flowByDate, today, language, CYCLE_HEATMAP_WEEKS),
    [flowByDate, today, language],
  );
  const compact = useMemo(
    () => buildCycleHeatmap(flowByDate, today, language, CYCLE_HEATMAP_COMPACT_WEEKS),
    [flowByDate, today, language],
  );

  const toCells = (cells: ReadonlyArray<CycleHeatCell | null>): Array<HeatmapCellInput | null> =>
    cells.map((c) => {
      if (!c) return null;
      const dateLabel = new Intl.DateTimeFormat(language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(`${c.iso}T12:00:00`));
      return {
        className: FLOW_FILL[c.flow],
        isToday: c.isToday,
        title: `${dateLabel} · ${t(`cycle.form.flow.${c.flow}`)}`,
      };
    });

  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(
      new Date(Date.UTC(2024, 0, 1 + i, 12)),
    ),
  );

  const legend = (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      {(['spotting', 'medium', 'heavy'] as CycleFlow[]).map((f) => (
        <li key={f} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-3 rounded-[2px] ${FLOW_FILL[f]}`} />
          <span>{t(`cycle.form.flow.${f}`)}</span>
        </li>
      ))}
    </ul>
  );

  const makeClick = (cells: ReadonlyArray<CycleHeatCell | null>) => (index: number) => {
    const iso = cells[index]?.iso;
    if (iso) onSelectDay(iso);
  };

  return (
    <>
      <div className="hidden md:block">
        <Heatmap
          weeks={CYCLE_HEATMAP_WEEKS}
          cells={toCells(full.cells)}
          monthLabels={full.monthLabels}
          dayLabels={dayLabels}
          legend={legend}
          onCellClick={makeClick(full.cells)}
          ariaLabel={t('cycle.view.heatmap')}
        />
      </div>
      <div className="md:hidden">
        <Heatmap
          weeks={CYCLE_HEATMAP_COMPACT_WEEKS}
          cells={toCells(compact.cells)}
          monthLabels={compact.monthLabels}
          dayLabels={dayLabels}
          legend={legend}
          onCellClick={makeClick(compact.cells)}
          ariaLabel={t('cycle.view.heatmap')}
        />
      </div>
    </>
  );
}
