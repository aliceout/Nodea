import type { ChangeEvent } from 'react';
import SurfaceCard from '@/ui/atoms/specifics/SurfaceCard.jsx';
import Select from '@/ui/atoms/form/Select.jsx';
import FormField from '@/ui/atoms/form/FormField.jsx';
import { useI18n } from '@/i18n/I18nProvider.jsx';

/**
 * Language preference.
 *
 * The i18n provider already persists the choice in `localStorage`
 * (key `nodea:language`). Per-user remote persistence via the legacy
 * `user-preferences` PB path is dropped — the new back has no
 * preferences blob yet. Re-introduce if / when needed.
 */
export default function LanguagePreferences() {
  const { t, language, setLanguage, availableLanguages } = useI18n();

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
  }

  return (
    <SurfaceCard tone="base" border="default" padding="md">
      <FormField
        label={t('settings.language.selectLabel', { defaultValue: 'Langue' })}
        htmlFor="settings-language"
      >
        <Select
          id="settings-language"
          value={language}
          onChange={handleChange}
          className="w-full sm:w-72"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </Select>
      </FormField>
    </SurfaceCard>
  );
}
