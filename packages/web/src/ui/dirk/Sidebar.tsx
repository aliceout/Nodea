import { Fragment } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline';

import {
  useNodeaStore,
  selectMobileMenuOpen,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import SidebarHeader from './sidebar/SidebarHeader';
import SidebarNav from './sidebar/SidebarNav';
import SidebarBackupCard from './sidebar/SidebarBackupCard';
import SidebarFooter from './sidebar/SidebarFooter';
import { useSidebarCollapsed } from './sidebar/use-sidebar-collapsed';

/**
 * Direction K · Sauge sidebar. Three responsive shapes share one
 * `<SidebarBody>`:
 *
 *   - **phone (< md)** — a slide-in drawer (full labels), via the topbar
 *     hamburger. 75 % of the viewport, capped at 300 px.
 *   - **`md`–`lg`** — a persistent 68 px **icon rail** (no room for the
 *     full column at these widths).
 *   - **`lg+`** — the full 240 px sidebar, or the icon rail when the user
 *     has collapsed it (a persisted choice, see `useSidebarCollapsed`).
 *     A footer chevron toggles between the two.
 *
 * `SidebarBody` takes `collapsed` (the user's choice) + `drawer` (full,
 * for the mobile drawer) and the pieces (`SidebarHeader`, `SidebarNav`,
 * `SidebarBackupCard`, `SidebarFooter`) adapt their own labels/layout.
 */
export default function Sidebar() {
  const open = useNodeaStore(selectMobileMenuOpen);
  const setOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <>
      <aside
        className={cn(
          'hidden shrink-0 border-r border-hair bg-bg-2 transition-[width] duration-200 ease-out md:sticky md:top-0 md:flex md:h-screen md:flex-col',
          // `md`–`lg` is always a rail ; `lg+` is full unless the user
          // collapsed it.
          collapsed ? 'w-[68px]' : 'w-[68px] lg:w-[240px]',
        )}
      >
        <SidebarBody
          onNavigate={() => undefined}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <Transition show={open} as={Fragment}>
        <Dialog className="relative z-50 md:hidden" onClose={() => setOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-in-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in-out duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-ink/30" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-200 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative flex w-3/4 max-w-[300px] bg-bg-2 border-r border-hair">
                <SidebarBody onNavigate={() => setOpen(false)} drawer />
              </DialogPanel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

interface SidebarBodyProps {
  onNavigate: () => void;
  /** Desktop shell only: the user's persisted collapse choice. */
  collapsed?: boolean;
  /** Toggles `collapsed`. Absent in the drawer (no collapse there). */
  onToggleCollapsed?: () => void;
  /** True inside the mobile drawer — always the full layout. */
  drawer?: boolean;
}

function SidebarBody({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
  drawer = false,
}: SidebarBodyProps) {
  return (
    <nav className="flex h-full min-h-0 w-full flex-col">
      <SidebarHeader onNavigate={onNavigate} collapsed={collapsed} drawer={drawer} />
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 pb-5 pt-4">
        <SidebarNav onNavigate={onNavigate} collapsed={collapsed} drawer={drawer} />
        <div className="flex-1" />
        {/* Bottom cluster — ONE hairline separates the nav from the toggle +
            status/prefs (full) or the account icon column (rail). The toggle
            and the footer rows share the same row shape so it reads as a
            single aligned list rather than mismatched chunks. */}
        <div className="mt-2 flex flex-col gap-0.5 border-t border-hair pt-2">
          {!drawer && onToggleCollapsed ? (
            <CollapseButton collapsed={collapsed} onToggle={onToggleCollapsed} />
          ) : null}
          {/* Cloud-backup progress card — full sidebar / drawer only (too
              wide for the 68 px rail). Renders null when no push runs. */}
          <div
            className={cn(
              drawer ? 'block' : collapsed ? 'hidden' : 'hidden lg:block',
            )}
          >
            <SidebarBackupCard />
          </div>
          <SidebarFooter onNavigate={onNavigate} collapsed={collapsed} drawer={drawer} />
        </div>
      </div>
    </nav>
  );
}

interface CollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Collapse / expand toggle — `lg+` only, since `md`–`lg` is a forced rail
 * (nothing to expand to) and the drawer never collapses. A double-chevron
 * pointing toward the action.
 */
function CollapseButton({ collapsed, onToggle }: CollapseButtonProps) {
  const { t } = useI18n();
  const label = collapsed
    ? t('layout.sidebar.expand', { defaultValue: 'Déplier le menu' })
    : t('layout.sidebar.collapse', { defaultValue: 'Réduire le menu' });
  const Icon = collapsed ? ChevronDoubleRightIcon : ChevronDoubleLeftIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn(
        'hidden w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:bg-bg hover:text-ink lg:flex',
        collapsed ? 'lg:justify-center' : 'lg:justify-start',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed ? 'hidden' : 'hidden lg:inline')}>{label}</span>
    </button>
  );
}
