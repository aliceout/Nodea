import { useEffect, useRef } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import InlinePanel from '@/ui/dirk/forms/InlinePanel';
import ModuleSettingsPanel from '@/ui/dirk/module/ModuleSettingsPanel';
import { useModuleSettings } from '@/ui/dirk/module/module-settings-context';
import PageHeading from '@/ui/dirk/module/PageHeading';

import GoalForm from '../components/GoalForm';
import { useGoalsActions, useGoalsFilters } from '../context';
import GoalCardGrid from './GoalCardGrid';
import GoalsList from './GoalsList';

/**
 * Top-level Goals rendering surface. Picks between the grouped row
 * list (« Liste ») and the responsive card grid (« Cartes ») based
 * on the persisted `viewMode` exposed by the filters context. Both
 * surfaces read from the same `data` + `filters` contexts ; the
 * switch here is just a presentation choice.
 *
 * Inline composer : when `formOpen` is true (the topbar
 * « + Nouvel objectif » CTA or a row's edit affordance flipped
 * it), `GoalForm` renders at the top of the surface, above the
 * list / cards. Cancel + post-save both call `closeForm` which
 * clears `editingEntry` and hides the form. Keyed on
 * `editingEntry?.id` so switching from edit-A to edit-B remounts
 * with the right initial values.
 */
export default function PrimaryColumn() {
  const { t } = useI18n();
  const { viewMode } = useGoalsFilters();
  const { formOpen, editingEntry, closeForm } = useGoalsActions();
  const moduleSettings = useModuleSettings();
  // The form and « Paramètre du module » are mutually exclusive — opening one
  // closes the other so they never stack (the just-opened panel wins).
  const openPanelsRef = useRef({ form: false, settings: false });
  useEffect(() => {
    const settingsOpen = !!moduleSettings?.open;
    const prev = openPanelsRef.current;
    if (settingsOpen && !prev.settings && formOpen) closeForm();
    else if (formOpen && !prev.form && settingsOpen) moduleSettings?.close();
    openPanelsRef.current = { form: formOpen, settings: settingsOpen };
  }, [formOpen, moduleSettings, closeForm]);

  return (
    <div className="min-w-0">
      {/* lg+ only — on mobile the topbar carries the module name. Lifted here
          (was in GoalCardGrid / GoalsList) so the title stays ABOVE the inline
          panel + form, like Mood / Journal. */}
      <PageHeading className="hidden lg:block">{t('goals.title')}</PageHeading>
      {/* « Paramètre du module » — inline panel, toggled from the sidebar link;
          mutually exclusive with the form. */}
      <InlinePanel open={!!moduleSettings?.open}>
        <ModuleSettingsPanel onClose={() => moduleSettings?.close()} />
      </InlinePanel>
      {formOpen ? (
        <GoalForm
          key={editingEntry?.id ?? 'create'}
          {...(editingEntry ? { initial: editingEntry } : {})}
          onClose={closeForm}
        />
      ) : null}
      {viewMode === 'cards' ? <GoalCardGrid /> : <GoalsList />}
    </div>
  );
}
