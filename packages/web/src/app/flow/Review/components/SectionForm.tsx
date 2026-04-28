import Input from '@/ui/atoms/dirk/Input';
import Textarea from '@/ui/atoms/dirk/Textarea';
import type { Step } from '../config/steps';
import StringListEditor from './StringListEditor';
import YearImageStep from './YearImageStep';

interface SectionFormProps {
  step: Step;
  value: unknown;
  onChange: (next: unknown) => void;
}

const FIELD_LABEL_CLASS =
  'mb-1 block text-[12px] font-medium text-muted';

/**
 * Type-driven renderer for a single step. Picks the editor based on
 * `step.kind` — the Wizard stays declarative.
 */
export default function SectionForm({ step, value, onChange }: SectionFormProps) {
  switch (step.kind) {
    case 'textarea':
      return (
        <Textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          {...(step.placeholder ? { placeholder: step.placeholder } : {})}
          rows={8}
          minHeightPx={180}
        />
      );

    case 'string_list': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <StringListEditor
          value={arr}
          onChange={(next) => onChange(next)}
          {...(step.placeholder ? { placeholder: step.placeholder } : {})}
        />
      );
    }

    case 'keyed_text': {
      const obj = (value ?? {}) as Record<string, string>;
      return (
        <div className="space-y-4">
          {step.fields.map((f) => (
            <label key={f.key} className="block">
              <span className={FIELD_LABEL_CLASS}>{f.label}</span>
              <Textarea
                value={obj[f.key] ?? ''}
                onChange={(e) => onChange({ ...obj, [f.key]: e.target.value })}
                rows={2}
                minHeightPx={64}
              />
            </label>
          ))}
        </div>
      );
    }

    case 'keyed_list': {
      const obj = (value ?? {}) as Record<string, string[]>;
      return (
        <div className="space-y-5">
          {step.fields.map((f) => {
            const list = Array.isArray(obj[f.key]) ? (obj[f.key] as string[]) : [];
            return (
              <div key={f.key}>
                <p className={FIELD_LABEL_CLASS}>{f.label}</p>
                <StringListEditor
                  value={list}
                  onChange={(next) => onChange({ ...obj, [f.key]: next })}
                />
              </div>
            );
          })}
        </div>
      );
    }

    case 'closing_last': {
      const obj = (value ?? {}) as { book_title?: string; three_words?: string[] };
      return (
        <div className="space-y-5">
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>
              Si cette année avait été un livre, son titre serait…
            </span>
            <Input
              type="text"
              value={obj.book_title ?? ''}
              onChange={(e) => onChange({ ...obj, book_title: e.target.value })}
            />
          </label>
          <div>
            <p className={FIELD_LABEL_CLASS}>Trois mots pour la résumer</p>
            <StringListEditor
              value={Array.isArray(obj.three_words) ? obj.three_words : []}
              onChange={(next) => onChange({ ...obj, three_words: next })}
              placeholder="Un mot…"
            />
          </div>
        </div>
      );
    }

    case 'closing_final': {
      const obj = (value ?? {}) as {
        letter_to_self?: string;
        commitment?: string;
        signature?: string;
        date?: string;
      };
      return (
        <div className="space-y-4">
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Lettre à moi-même</span>
            <Textarea
              value={obj.letter_to_self ?? ''}
              onChange={(e) => onChange({ ...obj, letter_to_self: e.target.value })}
              rows={6}
              minHeightPx={140}
            />
          </label>
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>Mon engagement</span>
            <Textarea
              value={obj.commitment ?? ''}
              onChange={(e) => onChange({ ...obj, commitment: e.target.value })}
              rows={3}
              minHeightPx={80}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="block flex-1 min-w-40">
              <span className={FIELD_LABEL_CLASS}>Signature</span>
              <Input
                type="text"
                value={obj.signature ?? ''}
                onChange={(e) => onChange({ ...obj, signature: e.target.value })}
              />
            </label>
            <label className="block flex-1 min-w-40">
              <span className={FIELD_LABEL_CLASS}>Date</span>
              <Input
                type="date"
                value={obj.date ?? ''}
                onChange={(e) => onChange({ ...obj, date: e.target.value })}
              />
            </label>
          </div>
        </div>
      );
    }

    case 'year_image':
      return (
        <YearImageStep
          value={typeof value === 'string' ? value : undefined}
          onChange={(next) => onChange(next)}
        />
      );
  }
}
