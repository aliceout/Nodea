import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkInput from '@/ui/atoms/dirk/Input';

interface ThreadSuggestInputProps {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<string>;
  disabled?: boolean;
  onSubmit: () => void;
}

/**
 * Free-text thread input with dropdown suggestions drawn from
 * the user's existing threads : type to filter, pick from the
 * dropdown to commit a known fil, or just keep typing to create
 * a new one.
 *
 * Single-valued : an entry belongs to exactly one thread.
 * Pre-existing comma-separated values from earlier iterations
 * are still loaded for the suggestion source but are not
 * produced by this input.
 *
 * Keyboard :
 *   - `↑` / `↓` move the highlight inside the dropdown.
 *   - `Enter` picks the highlighted suggestion.
 *   - `⌘↵` / `Ctrl↵` submits the surrounding form.
 *   - `Esc` closes the dropdown (Headless UI's outer Dialog
 *     swallows global Esc so we don't close the modal here).
 *
 * Click-outside also closes the dropdown ; mouse picks use
 * `onMouseDown` (not `onClick`) so the input doesn't blur and
 * dismiss the panel before the pick handler runs.
 */
export default function ThreadSuggestInput({
  value,
  onChange,
  options,
  disabled,
  onSubmit,
}: ThreadSuggestInputProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const trimmed = value.trim();

  const suggestions = useMemo<string[]>(() => {
    const needle = trimmed.toLocaleLowerCase('fr');
    const list: string[] = [];
    for (const opt of options) {
      if (needle && !opt.toLocaleLowerCase('fr').includes(needle)) continue;
      // Hide exact-match-only options (the user already typed
      // the whole thread name — nothing left to suggest).
      if (opt.toLocaleLowerCase('fr') === needle) continue;
      list.push(opt);
      if (list.length >= 8) break;
    }
    return list;
  }, [options, trimmed]);

  // Clamp the highlight when the suggestion list shrinks
  // under it.
  useEffect(() => {
    if (highlight >= suggestions.length) setHighlight(0);
  }, [suggestions.length, highlight]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return undefined;
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [open]);

  function pick(option: string): void {
    onChange(option);
    setOpen(false);
    setHighlight(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const choice = suggestions[highlight];
      if (choice) pick(choice);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <DirkInput
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={t('modals.composer.threadSuggest.placeholder')}
        disabled={disabled}
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="journal-thread-suggest"
      />
      {showDropdown ? (
        <ul
          id="journal-thread-suggest"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-sm border border-hair bg-bg py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
        >
          {suggestions.map((option, i) => {
            const isHighlighted = i === highlight;
            return (
              <li key={option} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // `onMouseDown` (not `onClick`) so the
                    // input doesn't blur and dismiss the panel
                    // before we get the chance to handle the
                    // pick.
                    e.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors',
                    isHighlighted
                      ? 'bg-accent-soft text-accent-deep'
                      : 'text-ink-soft hover:bg-bg-2',
                  )}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
