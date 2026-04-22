import { STEPS, GROUP_LABELS } from '../config/steps';

interface StepNavProps {
  index: number;
  onJump: (idx: number) => void;
  completed: Set<number>;
}

/**
 * Progress rail + clickable step list. Completed steps get filled; the
 * current step is highlighted; future steps are dimmed.
 */
export default function StepNav({ index, onJump, completed }: StepNavProps) {
  const total = STEPS.length;
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full bg-slate-900 transition-all dark:bg-slate-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs tabular-nums opacity-70">
          {index + 1} / {total}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 text-xs">
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
              className={
                'h-2 min-w-3 flex-grow rounded transition-colors ' +
                (active
                  ? 'bg-emerald-600'
                  : done
                    ? 'bg-slate-500 dark:bg-slate-400'
                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600')
              }
            />
          );
        })}
      </div>
    </div>
  );
}
