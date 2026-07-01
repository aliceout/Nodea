/**
 * Cycle heatmap view — the GitHub-contributions frise (spec §6, 4th
 * view) reusing the shared `ui/dirk/Heatmap` component, exactly like
 * Mood / Journal. Flow days are shaded on the warm « low » ramp
 * (spotting → heavy) over ~6 months ; clicking a day opens its form.
 */
import type { CycleFlow } from '@nodea/shared';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, { type HeatmapCellInput } from '@/ui/dirk/Heatmap';
import { buildCycleHeatmap, CYCLE_HEATMAP_WEEKS } from '../lib/heatmap';

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
  const { cells, monthLabels } = buildCycleHeatmap(flowByDate, today, language);

  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: 'short' }).format(
      new Date(Date.UTC(2024, 0, 1 + i, 12)),
    ),
  );

  const cellInputs: Array<HeatmapCellInput | null> = cells.map((c) => {
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

  const isoDays = cells.map((c) => c?.iso ?? null);

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

  return (
    <Heatmap
      weeks={CYCLE_HEATMAP_WEEKS}
      cells={cellInputs}
      monthLabels={monthLabels}
      dayLabels={dayLabels}
      legend={legend}
      onCellClick={(i) => {
        const iso = isoDays[i];
        if (iso) onSelectDay(iso);
      }}
      ariaLabel={t('cycle.view.heatmap')}
    />
  );
}
