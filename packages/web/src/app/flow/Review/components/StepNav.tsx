import { cn } from '@/lib/utils';
import { STEPS, GROUP_LABELS } from '../config/steps';

interface StepNavProps {
  index: number;
  onJump: (idx: number) => void;
  completed: Set<number>;
}

/**
 * Progress rail + clickable step list — Direction K · Sauge.
 *
 * Top: a thin overall progress bar. Bottom: one tick per step,
 * clickable, coloured by state — current = accent, completed =
 * ink-soft, future = bg-2.
 */
export default function StepNav({ index, onJump, completed }: StepNavProps) {
  const total = STEPS.length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 flex-wrap gap-1">
        {STEPS.map((s, i) => {
          const done = completed.has(i);
          const active = i === index;
          const group = GROUP_LABELS[s.group];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(i)}
              title={`${group} — ${s.title}`}
              aria-label={`${group} — ${s.title}`}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'h-1.5 min-w-3 flex-grow rounded-full transition-colors',
                active
                  ? 'bg-accent'
                  : done
                    ? 'bg-ink-soft hover:bg-ink'
                    : 'bg-bg-2 hover:bg-hair',
              )}
            />
          );
        })}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted">
        {index + 1} / {total}
      </span>
    </div>
  );
}
