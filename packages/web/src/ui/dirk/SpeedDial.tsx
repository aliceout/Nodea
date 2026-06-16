import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

/**
 * Mobile FAB — one floating bubble that fans out into its labelled
 * action(s) on tap. The single mobile create affordance across every
 * module : the Material speed-dial pattern, used uniformly whether a
 * surface has one action (Mood / Journal / Goals / Library / HRT Labs
 * / HRT Produits) or several (HRT Administration : « prise manuelle » +
 * « prise récurrente »). One bubble, one behaviour, everywhere.
 *
 * Resting state is a single « + » bubble — what the user sees while
 * scrolling. Tapping it rotates the « + » into a « × » and reveals the
 * action(s) stacked above (primary closest to the thumb) ; tapping
 * again, Échap, a tap outside, or any scroll closes it back to the one
 * bubble. `lg:hidden` : desktop keeps the in-body / topbar buttons.
 *
 * The toggle disables itself when every action is disabled, so it can't
 * open onto a dead menu (e.g. Library before any book exists).
 *
 * Portalled to `document.body` : `ModuleShell`'s wrapper carries
 * `animate-fade-up`, whose keyframe ends on `transform: translateY(0)`
 * with fill-mode `both`. A persistent non-`none` transform makes that
 * wrapper a containing block that would trap `position: fixed` (the
 * bubble would anchor to the full-height wrapper, not the viewport), so
 * the dial must portal out to anchor to the viewport.
 */
export interface SpeedDialAction {
  /** Action text. A leading textual « + » is stripped (the pill draws
   *  its own icon). */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface SpeedDialProps {
  /** Accessible name of the toggle while closed (e.g. « Ajouter »). */
  addLabel: string;
  /** Accessible name while open + for the tap-outside backdrop. */
  closeLabel: string;
  /** Top-to-bottom render order ; the LAST entry sits nearest the
   *  bubble (most thumb-reachable), so pass the primary action last. */
  actions: SpeedDialAction[];
  /** Hidden entirely while a form already owns the screen. */
  hidden?: boolean;
}

export default function SpeedDial({
  addLabel,
  closeLabel,
  actions,
  hidden = false,
}: SpeedDialProps) {
  const [open, setOpen] = useState(false);

  // Any scroll curls it back to a single bubble ; Échap closes too.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (hidden) return null;

  // No openable menu if nothing can be actioned — keep the bubble inert
  // (parity with a disabled single CTA).
  const allDisabled = actions.every((a) => a.disabled);

  return createPortal(
    <div className="lg:hidden">
      {open ? (
        // Tap-outside-to-close. A labelled button (not a bare div) so
        // it stays keyboard / screen-reader reachable.
        <button
          type="button"
          aria-label={closeLabel}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default"
        />
      ) : null}

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
        {open
          ? actions.map((a, i) => (
              <Button
                key={a.label}
                variant="neutral"
                onClick={() => {
                  a.onClick();
                  setOpen(false);
                }}
                disabled={a.disabled}
                className="animate-fade-up h-12 gap-2 rounded-full px-5 shadow-lg motion-reduce:animate-none"
                // Fan out from the bubble upward — nearest pill first.
                style={{ animationDelay: `${(actions.length - 1 - i) * 40}ms` }}
              >
                <PlusIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {a.label.replace(/^\+\s*/, '')}
              </Button>
            ))
          : null}

        <Button
          variant="primary"
          onClick={() => setOpen((o) => !o)}
          disabled={allDisabled}
          aria-label={open ? closeLabel : addLabel}
          aria-expanded={open}
          className="h-14 w-14 gap-0 rounded-full p-0 shadow-lg"
        >
          {/* The « + » rotates into a « × » when open. */}
          <PlusIcon
            className={cn(
              'h-6 w-6 transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-45',
            )}
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
