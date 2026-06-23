import type { ReactNode } from 'react';

/**
 * Small muted « Gérer les … » text link for a SideColumn section header
 * (Journal « Gérer les fils », Goals « Gérer les thèmes »). Renders in
 * the `SectionLabel` `action` slot, so it sits on the right of the
 * section title on the same baseline.
 *
 * A real `<button>` (not an onClick div): keyboard-focusable with a
 * visible focus ring, underline on hover/focus. Shared so the two
 * thread/theme managers trigger from an identical affordance.
 */
interface ManageLinkProps {
  onClick: () => void;
  children: ReactNode;
}

export default function ManageLink({ onClick, children }: ManageLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 cursor-pointer text-[11.5px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}
