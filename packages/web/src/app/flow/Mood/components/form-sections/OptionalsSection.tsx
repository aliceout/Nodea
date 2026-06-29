import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkTextarea from '@/ui/atoms/dirk/Textarea';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

/**
 * Mood composer — collapsible « question du jour » + free
 * comment block. Both fields are textareas with `autoGrow` so
 * long answers expand the field downwards as the user types
 * rather than scrolling inside a small box (the original
 * complaint that prompted this refactor).
 *
 * The pair is shown/hidden as one unit by the parent toggle —
 * keeps the composer compact for the « quick capture » path
 * (3 positives + score, the most common cadence) without
 * hiding the optionals when an entry actually has them.
 *
 * The « question du jour » block is skipped entirely when there's no
 * question AND no answer typed — this is the `moodOfferDailyQuestion`
 * pref turned off (the parent draws no question), where the user wants
 * just the free comment, not an orphan answer field labelled « — ».
 */
interface OptionalsSectionProps {
  question: string;
  answer: string;
  comment: string;
  onAnswerChange: (next: string) => void;
  onCommentChange: (next: string) => void;
  onSubmit: () => void;
}

export default function OptionalsSection({
  question,
  answer,
  comment,
  onAnswerChange,
  onCommentChange,
  onSubmit,
}: OptionalsSectionProps) {
  const { t } = useI18n();
  const showQuestion = question.length > 0 || answer.length > 0;
  return (
    <div className="space-y-3 pt-1">
      {showQuestion ? (
        <div>
          <p className="mb-1 text-[12px] text-muted">
            <span className="font-semibold tracking-[0.02em]">
              {t('mood.composer.questionLabel')}
            </span>
            <span className="font-serif italic text-ink-soft">{question || '—'}</span>
          </p>
          <DirkTextarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
            placeholder={t('mood.composer.answerPlaceholder')}
            rows={2}
            minHeightPx={56}
            autoGrow
          />
        </div>
      ) : null}

      <div>
        <SectionLabel>{t('mood.composer.commentHeading')}</SectionLabel>
        <DirkTextarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
          placeholder={t('mood.composer.commentPlaceholder')}
          rows={3}
          minHeightPx={84}
          autoGrow
        />
      </div>
    </div>
  );
}
