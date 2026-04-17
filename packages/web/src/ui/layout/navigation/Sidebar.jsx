import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigate, useParams } from "react-router-dom";

import {
  useNodeaStore,
  selectModules,
  selectMobileMenuOpen,
} from "@/core/store/nodea-store";

import Logo from "@/ui/branding/LogoLong.jsx";
import Link from "../components/SideLinks.jsx";

import { MODULES } from "@/app/config/modules_list";
import { useI18n } from "@/i18n/I18nProvider.jsx";

// Mobile drawer for small screens. Reads the open/close flag from the
// Zustand UI slice; desktop layout uses HeaderNav instead.
export default function Sidebar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const current = moduleId ?? "home";
  const open = useNodeaStore(selectMobileMenuOpen);
  const setOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const modules = useNodeaStore(selectModules);

  const visibleItems = (MODULES || []).filter((i) => {
    if (i.display === false) return false;
    if (!i.to_toggle) return true;
    return Boolean(modules[i.id]?.enabled);
  });

  const handleSelect = (id) => {
    navigate(`/flow/${id}`);
    setOpen(false);
  };

  const handleClose = () => setOpen(false);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50 lg:hidden" onClose={handleClose}>
        <div className="fixed inset-0" />
        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="flex grow flex-col overflow-y-auto border-r border-gray-200 bg-white px-4 pb-4 transition-colors dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-16 items-center justify-between pr-2">
                  <Logo className="w-1/2" />
                  <button
                    type="button"
                    className="-m-2.5 p-2.5 text-gray-700 transition-colors dark:text-slate-200"
                    onClick={handleClose}
                    aria-label={t("layout.sidebar.closeMenu", {
                      defaultValue: "Fermer le menu",
                    })}
                  >
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <nav className="mt-4 flex flex-1 flex-col justify-between">
                  <ul role="list" className="space-y-1">
                    {visibleItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          icon={item.icon}
                          label={t(item.label, { defaultValue: item.label })}
                          active={current === item.id}
                          onClick={() => handleSelect(item.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </DialogPanel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
