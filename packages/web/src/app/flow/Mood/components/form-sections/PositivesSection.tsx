import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkInput from '@/ui/atoms/dirk/Input';
import SectionLabel from '@/ui/dirk/module/SectionLabel';

import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

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
  // Translated at the render site — each placeholder nudges the
  // user toward a different angle on the day. It doubles as the
  // input's accessible name (no visible per-field label).
  const placeholders: [string, string, string] = [
    t('mood.composer.positivePlaceholder1'),
    t('mood.composer.positivePlaceholder2'),
    t('mood.composer.positivePlaceholder3'),
  ];
  return (
    <div className="space-y-2">
      <SectionLabel>{t('mood.composer.positivesHeading')}</SectionLabel>
      {([0, 1, 2] as const).map((i) => (
        <DirkInput
          key={i}
          value={values[i]}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => submitOnCmdEnter(e, onSubmit)}
          placeholder={placeholders[i]}
          aria-label={placeholders[i]}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
