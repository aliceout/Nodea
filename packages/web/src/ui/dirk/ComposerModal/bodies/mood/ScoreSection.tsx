import { MOOD_SCORE_VALUES, type MoodScore } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

/**
 * Mood composer — −2..+2 score picker.
 *
 * Five segmented buttons rendered in a fixed five-column grid.
 * Tone tracks sign : positives use the accent palette, negatives
 * the "low" palette, the neutral middle stays on the neutral
 * surface. `aria-pressed` carries the selected state for
 * assistive tech (no native radio-group ARIA — the button-
 * group pattern is closer to the visual intent).
 */
interface ScoreSectionProps {
  value: MoodScore | null;
  onChange: (next: MoodScore) => void;
}

export default function ScoreSection({ value, onChange }: ScoreSectionProps) {
  const { t } = useI18n();
  return (
    <div>
      <SectionLabel>{t('mood.composer.scoreHeading')}</SectionLabel>
      <div className="grid grid-cols-5 gap-1.5">
        {MOOD_SCORE_VALUES.map((v) => {
          const selected = value === v;
          const numeric = Number(v);
          const tone =
            numeric > 0
              ? selected
                ? 'bg-accent text-white border-accent'
                : 'bg-bg text-ink-soft border-hair hover:border-accent'
              : numeric < 0
                ? selected
                  ? 'bg-low text-white border-low'
                  : 'bg-bg text-ink-soft border-hair hover:border-low'
                : selected
                  ? 'bg-bg-2 text-ink border-ink-soft'
                  : 'bg-bg text-ink-soft border-hair hover:border-ink-soft';
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-sm border px-2 py-1.5 text-[11px] transition-colors',
                tone,
              )}
            >
              <span className="text-[14px] font-semibold tabular-nums">
                {numeric > 0 ? `+${v}` : v}
              </span>
              <span className="text-[10px] tracking-[0.02em]">
                {t(`mood.scoreLabels.${v}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
