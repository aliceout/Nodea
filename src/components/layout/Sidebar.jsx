// src/components/layout/Sidebar.jsx
import { Dialog, DialogPanel, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { useStore } from "../../store/StoreProvider";
import { selectCurrentTab, selectMobileOpen } from "../../store/selectors";
import { closeMobile, setTab } from "../../store/actions";
import { nav } from "./Navigation";

export default function Sidebar() {
  // Lecture du store ici (plus de props open/current/onSelect/onClose)
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const dispatch = store?.dispatch ?? store?.[1];
  
  const current = selectCurrentTab(state);
  const open = selectMobileOpen(state);
  const modules = nav.filter((m) => m.display);
  
  
  const handleSelect = (id) => {
    dispatch(setTab(id));
    dispatch(closeMobile());
  };
  
  const handleClose = () => dispatch(closeMobile());
  
  return (
    <>
      {/* Drawer mobile */}
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
                <div className="flex grow flex-col overflow-y-auto bg-white px-4 pb-4 border-r border-gray-200">
                  <div className="flex h-16 items-center justify-between pr-2">
                    <Logo className="w-1/2" />
                    <button
                      type="button"
                      className="-m-2.5 p-2.5 text-gray-700"
                      onClick={handleClose}
                      aria-label="Fermer le menu"
                      >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <nav className="mt-4 flex flex-1 flex-col justify-between">
                    {/* Top items */}
                    <ul role="list" className="space-y-1">
                      {modules.map((item) => (
                        <li key={item.id}>
                          <Link
                            icon={item.icon}
                            label={item.label}
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
    </>
  );
}

import Logo from "../common/LogoLong.jsx";
import Link from "./components/SideLinks.jsx";