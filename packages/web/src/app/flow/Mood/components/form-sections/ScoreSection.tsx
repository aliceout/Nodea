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
  /** Id of the parent form's `role="alert"` error line when the
   *  surfaced error concerns the score (e.g. « Choisis une note du
   *  jour. ») — wired to the button group via `aria-describedby`
   *  so assistive tech reads the error with the group (audit
   *  2026-06, lot G). */
  ariaDescribedBy?: string | undefined;
}

export default function ScoreSection({
  value,
  onChange,
  ariaDescribedBy,
}: ScoreSectionProps) {
  const { t } = useI18n();
  return (
    <div>
      <SectionLabel>{t('mood.composer.scoreHeading')}</SectionLabel>
      <div
        role="group"
        aria-label={t('mood.composer.scoreHeading')}
        aria-describedby={ariaDescribedBy}
        className="grid grid-cols-5 gap-1.5"
      >
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
              // Single-line layout (number + label inline) with
              // `h-8` so the button matches the dirk `Input`'s
              // height exactly — the date picker next to it uses
              // the same atom, so the top + bottom edges of the
              // date row and the score row now align pixel-
              // perfectly. `items-center` (not `items-baseline`)
              // because the two spans have different font sizes ;
              // baseline alignment would visibly drop the smaller
              // « très bon » span below the centre line.
              //
              // Border-radius driven by the shared `--radius-input`
              // token so these picker cells stay aligned with the
              // form's Input / Textarea / Select corners. Was the
              // hardcoded `rounded-sm` (2px) which drifted visibly
              // when the inputs around them used a different
              // value.
              className={cn(
                'flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-input)] border px-2 text-[11px] transition-colors',
                tone,
              )}
            >
              <span className="text-[13px] font-semibold tabular-nums">
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
