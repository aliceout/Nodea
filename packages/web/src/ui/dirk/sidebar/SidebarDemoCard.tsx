import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';

/**
 * Demo-instance banner — a loud amber card in the sidebar, shown on any
 * non-production instance, never in the deployed prod. Makes « this is the demo,
 * not prod » impossible to miss so the two can't be confused.
 *
 * Detection: `import.meta.env.DEV` — true under `pnpm dev` (how the demo runs),
 * false in the production `vite build`. Nothing to configure: dev = demo, the
 * deployed prod build never shows it.
 */
export default function SidebarDemoCard() {
  const { t } = useI18n();
  if (!import.meta.env.DEV) return null;
  return (
    <div
      role="status"
      className="mb-1 flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500/10 px-2.5 py-2 text-[12px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
    >
      <ExclamationTriangleIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {t('layout.demo.title')}
    </div>
  );
}
