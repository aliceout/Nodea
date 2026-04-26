import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Minimum height in pixels — defaults to 72 (≈ 3 visible rows).
   * Library's 4ᵉ de couverture and Journal's body editor pass
   * larger values to fill their respective modal regions. */
  minHeightPx?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * K · Sauge multi-line text input. Same border / focus chrome as the
 * dirk Input, plus a configurable `minHeightPx` so each consumer can
 * size its writing surface to its modal's available room without
 * rolling new bespoke styling. `resize-none` is opinionated — the
 * surface is always supposed to grow with content via wrapping
 * rather than via a drag handle that breaks the modal layout.
 */
export default function Textarea({
  minHeightPx = 72,
  className,
  style,
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      ref={ref}
      style={{ minHeight: `${minHeightPx}px`, ...style }}
      className={cn(
        'block w-full resize-none rounded-sm border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
