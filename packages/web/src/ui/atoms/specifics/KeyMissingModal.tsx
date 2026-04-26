import { Fragment } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';

interface KeyMissingModalProps {
  onLogout: () => void;
  open?: boolean;
}

/**
 * Blocking modal — Direction K · Sauge.
 *
 * Shown when the in-memory main key is missing (page reload with a
 * valid session cookie but no password to re-derive it). The only
 * way out is to log out and log back in, so `onClose` is a no-op:
 * Esc and outside-click stay disabled.
 *
 * Mirrors the ComposerModal's Dialog/Transition shell so the visual
 * weight matches other K surfaces (papier crème, hairline border,
 * 12 px radius, soft shadow).
 */
export default function KeyMissingModal({ onLogout, open = true }: KeyMissingModalProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50" onClose={() => undefined}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center px-4">
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-3 scale-[0.98]"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 -translate-y-3 scale-[0.98]"
          >
            <DialogPanel className="relative w-full max-w-[420px] overflow-hidden rounded-[12px] border border-hair bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col items-stretch gap-3 px-6 py-6 text-center">
                <Dialog.Title className="text-[18px] font-semibold tracking-[-0.01em] text-ink">
                  Clé de chiffrement manquante
                </Dialog.Title>
                <p className="text-[13.5px] leading-[1.5] text-ink-soft">
                  La clé de chiffrement n’est plus disponible.
                  <br />
                  Merci de bien vouloir vous reconnecter.
                </p>
                <button
                  type="button"
                  onClick={onLogout}
                  autoFocus
                  className="mx-auto mt-2 cursor-pointer rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
                >
                  Se déconnecter
                </button>
              </div>
            </DialogPanel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
