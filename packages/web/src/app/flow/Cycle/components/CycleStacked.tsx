/**
 * Stacked-cycles view (spec §6) — the honest picture for irregular
 * cycles. One horizontal bar per completed cycle, all aligned at day 1
 * and scaled to the longest cycle, so length variability reads at a
 * glance. The dark segment is menstruation, the light one the rest of
 * the cycle. Pure CSS widths — no chart lib. Only completed cycles show
 * (the ongoing one has no length yet, comparing it would mislead).
 */
import type { CycleSpan } from '../lib/cycle-model';

interface Props {
  cycles: readonly CycleSpan[];
  language: string;
  emptyLabel: string;
  unit: (days: number) => string;
}

export default function CycleStacked({ cycles, language, emptyLabel, unit }: Props) {
  const completed = cycles.filter((c) => c.length != null).slice().reverse();
  if (completed.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const maxLen = Math.max(...completed.map((c) => c.length!));

  return (
    <div className="flex flex-col gap-2">
      {completed.map((c) => {
        const month = new Intl.DateTimeFormat(language, {
          month: 'short',
          year: '2-digit',
        }).format(new Date(`${c.start}T12:00:00`));
        const cycleW = (c.length! / maxLen) * 100;
        const periodW = Math.min((c.periodLength / c.length!) * 100, 100);
        return (
          <div key={c.start} className="flex items-center gap-2 text-[12px]">
            <span className="w-14 shrink-0 capitalize text-muted">{month}</span>
            <div className="relative h-4 flex-1 rounded-full bg-bg-2">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent/25"
                style={{ width: `${cycleW}%` }}
              >
                <div
                  className="h-full rounded-full bg-accent-strong"
                  style={{ width: `${periodW}%` }}
                />
              </div>
            </div>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted">
              {unit(c.length!)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
