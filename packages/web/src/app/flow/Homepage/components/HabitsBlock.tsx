import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import SectionLabel from './SectionLabel';

/**
 * Mock Habits block. Cells are computed from a sine wave so the
 * design hand-off has visual weight without real data ; once the
 * Habits module lands this becomes a real-data block like
 * `MoodBlock`.
 */
export default function HabitsBlock() {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>{t('home.habits.title')}</SectionLabel>
        <span className="animate-streak-pulse text-[12px] font-semibold tabular-nums text-accent">
          12 j
        </span>
      </div>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 60 }).map((_, i) => {
          const v = (Math.sin(i * 1.7) + 1) / 2;
          const cls =
            v > 0.7
              ? 'bg-accent'
              : v > 0.45
                ? 'bg-accent-soft'
                : v > 0.2
                  ? 'bg-bg-2'
                  : 'bg-hair';
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn('animate-cell-pop aspect-square rounded-sm', cls)}
              style={{ animationDelay: `${i * 6}ms` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>{t('home.habits.thisMonth', { values: { percent: 78 } })}</span>
        <span className="font-semibold text-sync">
          {t('home.habits.delta', { values: { delta: '+6', month: 'mars' } })}
        </span>
      </div>
    </section>
  );
}
