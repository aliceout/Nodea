import { useState } from 'react';

import { usePreferences } from '@/core/auth/use-preferences';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { SettingsGrid, SettingToggleRow } from '@/ui/dirk/module/SettingRow';

import {
  OPTIONAL_SECTION_IDS,
  STEPS,
  clampHiddenSections,
  type OptionalSectionId,
} from '../config/steps';
import { reviewKeepDraft, setReviewKeepDraft } from '../lib/keep-draft';

/**
 * Review « Paramètre du module » panel body.
 *
 * WHAT  Two settings: (1) which OPTIONAL sections show in the wizard + reader
 *       (`reviewHiddenSections`, encrypted prefs — one toggle per skippable
 *       section, checked = shown), and (2) « conserver les brouillons » — a
 *       LOCAL-ONLY per-device flag (localStorage, see lib/keep-draft.ts).
 * WHERE Rendered as CHILDREN of `<ModuleSettingsPanel>` inside the List view's
 *       `ReviewSettingsPanel` shell — a child of ModuleShell so the settings
 *       context resolves.
 * NOTE  Section visibility seeds the NEXT wizard open (« seed, never lock »):
 *       turning a section off adds its id to `reviewHiddenSections`; turning it
 *       on removes it. Default = nothing hidden ⇒ every section shown, matching
 *       the pre-preference behaviour exactly.
 */
const SECTION_TITLE: Record<OptionalSectionId, string> = Object.fromEntries(
  OPTIONAL_SECTION_IDS.map((id) => [id, STEPS.find((s) => s.id === id)?.title ?? id]),
) as Record<OptionalSectionId, string>;

export default function ReviewSettings() {
  const { t } = useI18n();
  const { preferences, setPreferences } = usePreferences();

  const hidden = clampHiddenSections(preferences.reviewHiddenSections);
  const hiddenSet = new Set<string>(hidden);

  // Local-only keep-draft flag — NOT the encrypted prefs blob (per-device
  // choice; see lib/keep-draft.ts). Seeded once from localStorage; the toggle
  // both updates local state and persists immediately.
  const [keepDraft, setKeepDraft] = useState<boolean>(() => reviewKeepDraft());

  function toggleSection(id: OptionalSectionId, shown: boolean): void {
    const currentlyShown = !hiddenSet.has(id);
    if (shown === currentlyShown) return; // equal-to-current guard
    const next = shown
      ? hidden.filter((h) => h !== id)
      : [...hidden, id];
    void setPreferences({ reviewHiddenSections: next });
  }

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted">
        {t('review.settings.sectionsHeading')}
      </p>
      <SettingsGrid>
        {OPTIONAL_SECTION_IDS.map((id) => (
          <SettingToggleRow
            key={id}
            id={`review-setting-section-${id}`}
            label={SECTION_TITLE[id]}
            checked={!hiddenSet.has(id)}
            onChange={(shown) => toggleSection(id, shown)}
          />
        ))}
      </SettingsGrid>
      <SettingToggleRow
        id="review-setting-keep-draft"
        label={t('review.settings.keepDraftLabel')}
        hint={t('review.settings.keepDraftHint')}
        checked={keepDraft}
        onChange={(v) => {
          setKeepDraft(v);
          setReviewKeepDraft(v);
        }}
      />
    </div>
  );
}
