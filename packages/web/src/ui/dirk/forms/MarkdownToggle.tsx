import { cn } from '@/lib/utils';

interface MarkdownToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Pill toggle that flips the Journal editor between visual
 * (Word-like contentEditable, default) and Markdown source
 * view. Sits in the Composer footer so the editor surface
 * stays uncluttered.
 *
 * `value === true` = Markdown source view (pressed) ;
 * `value === false` = visual edit (default).
 */
export default function MarkdownToggle({ value, onChange }: MarkdownToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      title={value ? 'Repasser en édition visuelle' : 'Voir la source Markdown'}
      className={cn(
        'cursor-pointer rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors',
        value
          ? 'bg-accent-soft text-accent-deep'
          : 'text-muted hover:bg-bg-2 hover:text-ink',
      )}
    >
      Markdown
    </button>
  );
}
