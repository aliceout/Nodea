import { useState, type KeyboardEvent } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Add / remove text entries one by one — Direction K · Sauge.
 *
 * Used for `agenda_review`, `best_moments`, `three_challenges`,
 * etc. Each existing item gets an inline delete affordance; a
 * footer row holds the « add » input + button.
 */
export default function StringListEditor({ value, onChange, placeholder }: Props) {
  const { t } = useI18n();
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
      <ul className="space-y-1.5">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <Input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
            />
            <Button
              variant="danger-ghost"
              size="sm"
              iconOnly
              onClick={() => remove(i)}
              aria-label={t('review.stringList.removeAria')}
            >
              <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t('review.stringList.addPlaceholder')}
          className="border-dashed"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={commit}
          disabled={!draft.trim()}
        >
          {t('review.stringList.addCta')}
        </Button>
      </div>
    </div>
  );
}
