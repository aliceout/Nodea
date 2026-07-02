import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkTextarea from '@/ui/atoms/dirk/Textarea';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

/**
 * Mood composer — the free-text « Mot du jour » (payload `comment`). Always in
 * the main questionnaire beside the score: it's the one free field offered on
 * every entry, so unlike the question / positives it has no placement setting.
 * Split out of the former `OptionalsSection` when the block moved out of the
 * drawer into the always-on form.
 */
interface CommentSectionProps {
  comment: string;
  onCommentChange: (next: string) => void;
  onSubmit: () => void;
}

export default function CommentSection({
  comment,
  onCommentChange,
  onSubmit,
}: CommentSectionProps) {
  const { t } = useI18n();
  return (
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
  );
}
