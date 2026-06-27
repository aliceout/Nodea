import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

import { useNodeaStore, selectBackupProgress } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';

/**
 * Cloud-backup progress card — sits in the sidebar body ABOVE the footer's
 * border, shown only while a push runs. A dedicated card (not the muted footer
 * status line) plus a real progress bar makes an in-flight backup clearly
 * visible: it reads as an event, not a status footnote.
 *
 * The bar is DETERMINATE and event-driven (`backupProgress`, a real `0..1`):
 * the collect phase advances it module by module, then seal + upload land as
 * honest jumps. The `transition-[width]` smooths the steps so a coarse, real
 * signal still reads as fluid motion — no fake creep, no sweeping in the void.
 */
export default function SidebarBackupCard() {
  const { t } = useI18n();
  const progress = useNodeaStore(selectBackupProgress);
  if (progress === null) return null;

  const pct = Math.round(progress * 100);
  const label = t('layout.backup.running');
  return (
    <div role="status" className="mb-1 rounded-md border border-hair bg-bg px-2.5 py-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-accent-deep">
        <CloudArrowUpIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" />
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 overflow-hidden rounded-full bg-accent-soft"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
