import { useState, type KeyboardEvent } from 'react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Add / remove text entries one by one. Used for agenda_review,
 * best_moments, three_challenges, etc.
 */
export default function StringListEditor({ value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState('');

  function commit(): void {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  }

  function update(i: number, next: string): void {
    const copy = value.slice();
    copy[i] = next;
    onChange(copy);
  }

  function remove(i: number): void {
    onChange(value.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 rounded border border-slate-300 p-2 text-sm"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Retirer"
              className="rounded px-2 text-slate-400 hover:text-red-600"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Ajouter…'}
          className="flex-1 rounded border border-dashed border-slate-300 p-2 text-sm"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}
