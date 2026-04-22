import { useState, type KeyboardEvent } from 'react';

interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Minimal chips input. Press Enter or comma to commit a tag; click the
 * × on a chip to remove it.
 */
export default function TagsInput({ value, onChange, placeholder }: TagsInputProps) {
  const [draft, setDraft] = useState('');

  function commit(): void {
    const next = draft.trim();
    if (!next) return;
    if (value.includes(next)) {
      setDraft('');
      return;
    }
    onChange([...value, next]);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1 rounded border border-slate-300 p-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Retirer ${tag}`}
            className="text-slate-500 hover:text-red-600"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[8rem] bg-transparent px-1 text-sm focus:outline-none"
      />
    </div>
  );
}
