import type { ChangeEvent } from 'react';

import {
  useBackgroundShade,
  type BackgroundShade,
  type BackgroundShadeDark,
} from '@/core/theme/useBackgroundShade';
import { useTheme, type ThemePreference } from '@/core/theme/useTheme';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Select from '@/ui/atoms/dirk/Select';

import DescribedSection from '../components/DescribedSection';
import {
  BACKGROUND_SHADE_OPTIONS,
  BACKGROUND_SHADE_DARK_OPTIONS,
  THEME_OPTIONS,
} from '../lib/constants';

/** « Préférences » tab — theme + language pickers. Same
 *  `DescribedSection` row as the Security tab, but with a wider
 *  control column (200 px to fit the `<select>`s) and centred
 *  alignment since the descriptor here is a single line. Keeps
 *  the two surfaces visually consistent so a user toggling between
 *  Settings tabs doesn't have to re-parse the layout. */
export default function PreferencesTab() {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const { theme, setTheme } = useTheme();
  const { shade, setShade, darkShade, setDarkShade } = useBackgroundShade();

  function handleLanguage(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
  }

  function handleTheme(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value as ThemePreference;
    if (!THEME_OPTIONS.includes(next) || next === theme) return;
    setTheme(next);
  }

  function handleShade(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value as BackgroundShade;
    if (!BACKGROUND_SHADE_OPTIONS.includes(next) || next === shade) return;
    setShade(next);
  }

  function handleDarkShade(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value as BackgroundShadeDark;
    if (!BACKGROUND_SHADE_DARK_OPTIONS.includes(next) || next === darkShade)
      return;
    setDarkShade(next);
  }

  return (
    <div className="max-w-[880px] divide-y divide-hair">
      <DescribedSection
        title={t('settings.theme.title')}
        description={t('account.preferences.themeDescription')}
        controlWidth={200}
        align="center"
      >
        <Select
          aria-label={t('settings.theme.ariaLabel')}
          value={theme}
          onChange={handleTheme}
        >
          {THEME_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {t(`settings.theme.options.${id}`)}
            </option>
          ))}
        </Select>
      </DescribedSection>

      <DescribedSection
        title={t('settings.backgroundShade.title')}
        description={t('account.preferences.backgroundShadeDescription')}
        controlWidth={200}
        align="center"
      >
        <Select
          aria-label={t('settings.backgroundShade.ariaLabel')}
          value={shade}
          onChange={handleShade}
        >
          {BACKGROUND_SHADE_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {t(`settings.backgroundShade.options.${id}`)}
            </option>
          ))}
        </Select>
      </DescribedSection>

      <DescribedSection
        title={t('settings.backgroundShadeDark.title')}
        description={t('account.preferences.backgroundShadeDarkDescription')}
        controlWidth={200}
        align="center"
      >
        <Select
          aria-label={t('settings.backgroundShadeDark.ariaLabel')}
          value={darkShade}
          onChange={handleDarkShade}
        >
          {BACKGROUND_SHADE_DARK_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {t(`settings.backgroundShadeDark.options.${id}`)}
            </option>
          ))}
        </Select>
      </DescribedSection>

      <DescribedSection
        title={t('settings.language.title')}
        description={t('account.preferences.languageDescription')}
        controlWidth={200}
        align="center"
      >
        <Select
          aria-label={t('account.preferences.languageAriaLabel')}
          value={language}
          onChange={handleLanguage}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </Select>
      </DescribedSection>
    </div>
  );
}
