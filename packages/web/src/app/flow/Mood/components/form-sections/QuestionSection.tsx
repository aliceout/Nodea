import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkTextarea from '@/ui/atoms/dirk/Textarea';

import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

/**
 * Mood composer — the « question du jour » block: the drawn introspection
 * question + its answer textarea (`autoGrow` so a long answer expands the
 * field rather than scrolling inside a small box).
 *
 * Its position — main questionnaire, expandable drawer, or not offered — is
 * decided by the parent from `moodQuestionPlacement` (see
 * `Mood/lib/placements.ts`); this only renders the pair, and the parent never
 * mounts it with an empty question. Split out of the former `OptionalsSection`
 * when the free note moved to the always-on main form (`CommentSection`) and
 * the question became a placeable, per-user-configurable block.
 */
interface QuestionSectionProps {
  question: string;
  answer: string;
  onAnswerChange: (next: string) => void;
  onSubmit: () => void;
}

export default function QuestionSection({
  question,
  answer,
  onAnswerChange,
  onSubmit,
}: QuestionSectionProps) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-1.5 text-[13px] leading-snug text-muted">
        <span className="font-semibold tracking-[0.02em]">
          {t('mood.composer.questionLabel')}
        </span>
        <span className="italic text-ink">{question || '—'}</span>
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
  );
}
