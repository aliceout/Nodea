import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkInput from '@/ui/atoms/dirk/Input';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import { POSITIVE_PLACEHOLDERS } from '../../lib/constants';
import { submitOnCmdEnter } from '../../lib/format';

/**
 * Mood composer — "three positive things" section.
 *
 * Single-line inputs by design (each positive is meant to be a
 * short bullet, not a paragraph) ; long-form content goes in
 * the optional `comment` field handled by `OptionalsSection`.
 * The first input auto-focuses so the composer is keyboard-
 * usable from the moment it opens.
 */
interface PositivesSectionProps {
  values: [string, string, string];
  onChange: (idx: 0 | 1 | 2, value: string) => void;
  onSubmit: () => void;
}

export default function PositivesSection({
  values,
  onChange,
  onSubmit,
}: PositivesSectionProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <SectionLabel>{t('mood.composer.positivesHeading')}</SectionLabel>
      {[0, 1, 2].map((i) => (
        <DirkInput
          key={i}
          value={values[i as 0 | 1 | 2]}
          onChange={(e) => onChange(i as 0 | 1 | 2, e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
          placeholder={POSITIVE_PLACEHOLDERS[i] ?? ''}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
