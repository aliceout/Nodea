import type { ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { MODULE_FORM_CARD } from '@/ui/dirk/forms/constants';

/**
 * Inline « Paramètre du module » panel. Opens in the primary column exactly
 * like the entry composer — same `MODULE_FORM_CARD` chrome + bottom margin — so
 * it reads as the familiar inline-form pattern, not a foreign surface. The
 * shell (title + close) is shared; the body is per-module (`children`). Toggled
 * from the sidebar link through `useModuleSettings`.
 */
export default function ModuleSettingsPanel({
  children,
  onClose,
}: {
  children?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className={MODULE_FORM_CARD}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-ink">
          {t('modules.moduleSettings')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.actions.close')}
          className="rounded-sm p-1 text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {children ?? (
        <p className="text-[12px] leading-[1.5] text-muted">
          {t('modules.moduleSettingsPlaceholder')}
        </p>
      )}
    </section>
  );
}
