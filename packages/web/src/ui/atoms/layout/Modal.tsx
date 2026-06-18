import { Fragment, type ReactNode } from 'react';
import { Dialog, DialogPanel, Transition } from '@headlessui/react';
import { cn } from '@/lib/utils';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalAlign = 'top' | 'center';

interface ModalProps {
  /** Controls visibility — Headless UI's Transition handles the
   * fade/slide animation when this flips. */
  open: boolean;
  /** Called when the user dismisses via Esc / backdrop click. Pass a
   * no-op to make the modal non-dismissible (e.g. a blocking
   * "session locked" prompt whose only exit is its own action). */
  onClose: () => void;
  /** Maximum panel width — stays responsive on mobile/tablet, scales
   * up on large screens for content-heavy modals (Composer bodies
   * with multiple multi-line fields). Defaults to `md` (620 px),
   * the historical value every existing call-site relied on. `sm`
   * (420 px) is for short blocking prompts. */
  size?: ModalSize;
  /** Vertical placement. Defaults to `top` (the historical 12vh drop
   * every Composer/picker relies on); `center` is for short blocking
   * prompts that read better centred on screen. */
  align?: ModalAlign;
  /** Panel contents — typically a fixed-height body (`h-[600px]`)
   * so every modal in Nodea ends up the same physical size. */
  children: ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  // Short blocking prompts (KeyMissingModal) — a narrow panel that
  // doesn't read as a content surface.
  sm: 'max-w-[420px]',
  // Historical default — every modal in the app before the `size`
  // prop existed rendered at exactly 620 px. Kept as the no-op
  // default so existing call-sites are unaffected.
  md: 'max-w-[620px]',
  // Composer bodies with multi-line content (Mood, Journal, Library
  // Review) felt cramped on desktop. Steps kick in only at the
  // Tailwind `lg` breakpoint (≥ 1024 px) so phones and tablets
  // keep the original 620 px feel where it actually fits well.
  lg: 'max-w-[620px] lg:max-w-[820px] xl:max-w-[960px] 2xl:max-w-[1080px]',
  // Reserved for future heavy modals (large grids, multi-column
  // editors). Not used by any current consumer.
  xl: 'max-w-[620px] lg:max-w-[920px] xl:max-w-[1120px] 2xl:max-w-[1280px]',
};

/**
 * Standard K · Sauge modal shell — reused by every modal in the
 * app so they share position, animation, and chrome. The shell
 * handles:
 *
 *   - Backdrop + body click-to-dismiss + Esc-to-dismiss (Headless UI
 *     `Dialog` semantics — focus trap, scroll lock, aria wiring).
 *   - A responsive rounded panel with the project's hairline border
 *     + soft layered shadow. Width follows the `size` prop : the
 *     default `md` stays on the historical 620 px ; `lg` / `xl`
 *     scale up at the `lg:` Tailwind breakpoint (≥ 1024 px) so
 *     mobile/tablet keep the same feel.
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
export function Modal({ open, onClose, size = 'md', align = 'top', children }: ModalProps) {
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
        <div
          className={cn(
            'fixed inset-0 flex justify-center px-4',
            align === 'center'
              ? 'items-center'
              : 'items-start pt-[12vh] sm:pt-[110px]',
          )}
        >
          <Transition.Child
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 -translate-y-3 scale-[0.98]"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 -translate-y-3 scale-[0.98]"
          >
            <DialogPanel
              className={cn(
                'relative w-full overflow-hidden rounded-[12px] border border-hair bg-bg shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]',
                SIZE_CLASSES[size],
              )}
            >
              {children}
            </DialogPanel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
