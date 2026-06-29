import { cn } from '@/lib/utils';
import { GROUP_LABELS, type Step } from '../config/steps';

interface StepNavProps {
  /** Current position inside the ACTIVE steps array (intro included).
   *  « Active » = the visible steps after hidden sections are dropped. */
  index: number;
  /** Jump handler — receives the active-steps index. */
  onJump: (idx: number) => void;
  /** Set of active-steps indices currently considered « done ». */
  completed: Set<number>;
  /** Active step list (full STEPS minus hidden optional sections). */
  steps: Step[];
  /** The question-only subset of `steps` (intro screens dropped). */
  questionSteps: Step[];
}

/**
 * Progress rail + clickable step list — Direction K · Sauge.
 *
 * The rail is built from the ACTIVE `questionSteps` (welcome intro gets no
 * tick, and any section the user turned off is already absent), so the counter
 * « N / total » reflects the steps actually in the parcours. Shows « — / total »
 * while the user is still on the welcome screen.
 */
export default function StepNav({
  index,
  onJump,
  completed,
  steps,
  questionSteps,
}: StepNavProps) {
  const total = questionSteps.length;
  const currentStep = steps[index];
  const isOnIntro = currentStep?.kind === 'intro';
  const currentQuestion = isOnIntro
    ? -1
    : questionSteps.findIndex((s) => s.id === currentStep!.id);

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 flex-wrap gap-1">
        {questionSteps.map((s, i) => {
          const fullIdx = steps.indexOf(s);
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
                  ? 'bg-accent-strong'
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
