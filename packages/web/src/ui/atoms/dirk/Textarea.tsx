import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Minimum height in pixels — defaults to 72 (≈ 3 visible rows).
   * Library's 4ᵉ de couverture and Journal's body editor pass
   * larger values to fill their respective modal regions. */
  minHeightPx?: number;
  /** When true, the field grows downward as content is added (no
   * inner scrollbar until the surrounding modal scroll kicks in).
   * Implemented via the modern CSS `field-sizing: content` (Chrome
   * 123+, Safari 18+, Firefox 144+) — zero JS, no ResizeObserver,
   * the browser handles layout. `minHeightPx` keeps acting as the
   * floor. Opt-in so existing call-sites that count on a fixed
   * box (e.g. the Journal body inside a flex column) keep their
   * current behaviour unchanged. */
  autoGrow?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * K · Sauge multi-line text input. Same border / focus chrome as the
 * dirk Input, plus a configurable `minHeightPx` so each consumer can
 * size its writing surface to its modal's available room without
 * rolling new bespoke styling. `resize-none` is opinionated — the
 * surface is always supposed to grow with content via wrapping
 * rather than via a drag handle that breaks the modal layout.
 *
 * Pass `autoGrow` to make the field grow vertically as the user types
 * — useful when the modal has room and we'd rather avoid an inner
 * scrollbar (Mood comment / answer, where entries are often long
 * paragraphs).
 */
export default function Textarea({
  minHeightPx = 72,
  autoGrow = false,
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
        'block w-full resize-none rounded-[var(--radius-input)] border border-hair bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink placeholder:text-muted-soft',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none disabled:opacity-60',
        autoGrow && '[field-sizing:content]',
        className,
      )}
      {...props}
    />
  );
}
