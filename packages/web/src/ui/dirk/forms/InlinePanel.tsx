import type { ReactNode } from 'react';

/**
 * The shared mount slot for every inline surface that pops into a module's
 * primary column — the entry composers (Mood / Goals / Journal / Library / HRT)
 * and the « Paramètre du module » settings panel. Factors the one thing those
 * surfaces kept re-inlining: the `{open ? <div>…</div> : null}` mount wrapper, so
 * the panel and the form mount through the EXACT same component.
 *
 * It owns the mount, nothing else — no margin by default (the child card sits
 * flush; its `MODULE_FORM_CARD` chrome no longer carries a bottom margin) and no
 * animation here either: the rise + fade entrance lives on the child card
 * itself (`FORM_CARD`'s `animate-fade-up`),
 * so it plays whether or not a surface is wrapped in this slot. The extra "open
 * effect" some modules layer on top (e.g. Mood / Journal fold the heatmap above
 * the form) is choreography wired in that module's own hooks — NOT a property of
 * this wrapper.
 */
export default function InlinePanel({
  open,
  children,
  className = '',
}: {
  open: boolean;
  children: ReactNode;
  /** Optional layout hint for the call site (e.g. `shrink-0` in HRT's flex
   *  column). No margin by default — the form / panel card sits flush. */
  className?: string;
}) {
  if (!open) return null;
  return <div className={className}>{children}</div>;
}
