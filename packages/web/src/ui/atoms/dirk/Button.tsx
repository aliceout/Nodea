import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  // Primary — accent-filled, used for the dominant action of a
  // surface (Chercher, Ajouter à ma bibliothèque, Enregistrer).
  primary:
    'bg-accent text-white hover:bg-accent-hover active:translate-y-px',
  // Secondary — bordered, used for siblings of the primary action
  // (Annuler, Passer, dismiss buttons inside content blocks).
  secondary:
    'border border-hair bg-bg text-ink-soft hover:bg-bg-2 hover:text-ink',
  // Ghost — no background until hover, used for icon buttons and
  // toolbar widgets where filling the chrome would be too loud.
  ghost:
    'bg-transparent text-muted hover:bg-bg-2 hover:text-ink',
  // Danger — destructive variant of secondary (Supprimer, Reset).
  danger:
    'border border-hair bg-bg text-danger hover:bg-danger/10',
};

/**
 * K · Sauge button — same height (`h-8`) as Input/Select so the
 * three line up in inline rows (e.g. lookup bar input + select +
 * Chercher button). Variants cover the four button roles we
 * actually need; size is fixed because mixed sizes inside a row
 * was the main thing the user told us off about — see the chat log
 * for "tous les inputs on pas la même hauteur".
 *
 * For loose, square icon-only buttons (favorite star, trash, edit
 * pencil), keep using inline `<button>` with `h-7 w-7` — those are
 * a different visual shape and don't share this atom's height
 * contract.
 */
export default function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm px-3 text-[12px] font-semibold transition-[background-color,transform,color] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
