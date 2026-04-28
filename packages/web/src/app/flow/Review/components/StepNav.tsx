import { cn } from '@/lib/utils';
import { GROUP_LABELS, QUESTION_STEPS, STEPS } from '../config/steps';

interface StepNavProps {
  /** Current position inside the full STEPS array (intro included). */
  index: number;
  /** Jump handler — receives the full-STEPS index. */
  onJump: (idx: number) => void;
  /** Set of full-STEPS indices currently considered « done ». */
  completed: Set<number>;
}

/**
 * Progress rail + clickable step list — Direction K · Sauge.
 *
 * The rail is built from `QUESTION_STEPS`, so the welcome intro
 * doesn't get a tick. The counter shows « N / 15 » where N is the
 * 1-based position of the current step inside that filtered list
 * (« — / 15 » while the user is still on the welcome screen).
 */
export default function StepNav({ index, onJump, completed }: StepNavProps) {
  const total = QUESTION_STEPS.length;
  const currentStep = STEPS[index];
  const isOnIntro = currentStep?.kind === 'intro';
  const currentQuestion = isOnIntro
    ? -1
    : QUESTION_STEPS.findIndex((s) => s.id === currentStep!.id);

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 flex-wrap gap-1">
        {QUESTION_STEPS.map((s, i) => {
          const fullIdx = STEPS.indexOf(s);
          const done = completed.has(fullIdx);
          const active = i === currentQuestion;
          const group = GROUP_LABELS[s.group];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(fullIdx)}
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
        {isOnIntro ? `— / ${total}` : `${currentQuestion + 1} / ${total}`}
      </span>
    </div>
  );
}
