import { Fragment } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';

import {
  useNodeaStore,
  selectMobileMenuOpen,
} from '@/core/store/nodea-store';

import SidebarHeader from './sidebar/SidebarHeader';
import SidebarNav from './sidebar/SidebarNav';
import { SidebarTipModules } from './sidebar/SidebarTip';
import SidebarFooter from './sidebar/SidebarFooter';

/**
 * Direction K · Sauge sidebar — 240 px column on `lg+`, slide-in
 * drawer below. Pure orchestrator: it stitches together the four
 * pieces (`<SidebarHeader>`, `<SidebarNav>`, tip slot,
 * `<SidebarFooter>`) and handles the mobile-drawer plumbing. Each
 * piece lives in its own file under `./sidebar/` and is independent
 * — adding a new tip or a new footer widget doesn't require
 * touching this file.
 *
 * Tip slot lives between the nav (which can be short) and the
 * footer (always at the bottom). The `flex-1` spacer pushes the
 * tip + footer to the bottom of the viewport when the nav is short.
 */
export default function Sidebar() {
  const open = useNodeaStore(selectMobileMenuOpen);
  const setOpen = useNodeaStore((s) => s.setMobileMenuOpen);

  return (
    <>
      <SidebarShell>
        <SidebarBody onNavigate={() => undefined} />
      </SidebarShell>

      <Transition show={open} as={Fragment}>
        <Dialog className="relative z-50 lg:hidden" onClose={() => setOpen(false)}>
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
              <DialogPanel className="relative flex w-[240px] flex-1 bg-bg-2 border-r border-hair">
                <SidebarBody onNavigate={() => setOpen(false)} />
              </DialogPanel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

function SidebarShell({ children }: { children: React.ReactNode }) {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-hair bg-bg-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      {children}
    </aside>
  );
}

interface SidebarBodyProps {
  onNavigate: () => void;
}

function SidebarBody({ onNavigate }: SidebarBodyProps) {
  return (
    <nav className="flex h-full min-h-0 w-full flex-col gap-0.5 px-3 py-5">
      <SidebarHeader />
      <SidebarNav onNavigate={onNavigate} />
      <div className="flex-1" />
      {/* Tip slot — drop more `<SidebarTip*>` instances here as
          new nudges appear. Each one is independently dismissable
          and self-contained, so the slot stays a passive container. */}
      <SidebarTipModules />
      <SidebarFooter />
    </nav>
  );
}
