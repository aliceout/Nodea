import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

/**
 * Home « Paramètre du module » panel body.
 *
 * WHAT  Four toggles, one per personal card in the Homepage grid (hero /
 *       journalHeatmap / mood / goals — the full-width AnnouncementsCard is not
 *       toggleable). « Coché » = la carte est affichée ; décocher ajoute son id à
 *       la préférence `homeHiddenCards`.
 * WHERE Mounted by `views/PrimaryColumn.tsx` as children of `ModuleSettingsPanel`.
 * NOTE  `homeHiddenCards` is the inverse of « shown »: absent / empty ⇒ all four
 *       cards visible (zero-regression default). We store only the HIDDEN ids, so
 *       toggling a card back on removes it from the array rather than recording a
 *       redundant « shown » entry. Writes only when the value actually changes.
 */
const CARD_IDS = ['hero', 'journalHeatmap', 'mood', 'goals'] as const;
type CardId = (typeof CARD_IDS)[number];

export default function HomeSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();

  const hidden = preferences.homeHiddenCards ?? [];

  const setCardShown = (id: CardId, shown: boolean) => {
    const current = preferences.homeHiddenCards ?? [];
    const isHidden = current.includes(id);
    // Adding to / removing from the HIDDEN set — guard against no-op writes.
    if (shown && !isHidden) return;
    if (!shown && isHidden) return;
    const next = shown ? current.filter((c) => c !== id) : [...current, id];
    void setPreferences({ homeHiddenCards: next });
  };

  return (
    <SettingsGrid>
      {CARD_IDS.map((id) => (
        <SettingToggleRow
          key={id}
          id={`home-setting-card-${id}`}
          label={t(`home.settingsPanel.cards.${id}`)}
          checked={!hidden.includes(id)}
          onChange={(shown) => setCardShown(id, shown)}
        />
      ))}
    </SettingsGrid>
  );
}
