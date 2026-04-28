import { Fragment, type ReactNode } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';

interface ModalProps {
  /** Controls visibility — Headless UI's Transition handles the
   * fade/slide animation when this flips. */
  open: boolean;
  /** Called when the user dismisses via Esc / backdrop click. */
  onClose: () => void;
  /** Panel contents — typically a fixed-height body (`h-[600px]`)
   * so every modal in Nodea ends up the same physical size. */
  children: ReactNode;
}

/**
 * Standard K · Sauge modal shell — reused by every modal in the
 * app so they share size, position, animation, and chrome. The
 * shell handles:
 *
 *   - Backdrop + body click-to-dismiss + Esc-to-dismiss (Headless UI
 *     `Dialog` semantics — focus trap, scroll lock, aria wiring).
 *   - The 620 px-wide rounded panel with the project's hairline
 *     border + soft layered shadow.
 *   - The two-stage open / close animation (backdrop fades, panel
 *     translates + scales).
 *
 * What it deliberately does NOT impose: a body height. Most consumers
 * (the Composer bodies, the book picker) want the canonical
 * `h-[600px] max-h-[calc(100vh-200px)]` flex column for predictable
 * sizing — they set that on their own root div so the shell stays
 * usable for the rare modal that wants something different.
 *
 * Add a new modal? Wrap your body in `<Modal open onClose={…}>`. Do
 * NOT inline a fresh `<Dialog>` / `<Transition>` — every parallel
 * implementation drifts on padding, animation timing, or shadow,
 * and we end up with three "almost-the-same" modal styles.
 */
export function Modal({ open, onClose, children }: ModalProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50" onClose={onClose}>
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
        <div className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh] sm:pt-[110px]">
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-3 scale-[0.98]"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 -translate-y-3 scale-[0.98]"
          >
            <DialogPanel className="relative flex w-full max-w-[620px] flex-col overflow-hidden rounded-[12px] border border-hair bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)] max-h-[calc(100vh-160px)]">
              {children}
            </DialogPanel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
