import Input from '@/ui/atoms/dirk/Input';
import Textarea from '@/ui/atoms/dirk/Textarea';
import type { MixedFieldType, MixedKeyLabel, Step } from '../config/steps';
import StringListEditor from './StringListEditor';

interface SectionFormProps {
  step: Step;
  value: unknown;
  onChange: (next: unknown) => void;
}

const FIELD_LABEL_CLASS = 'mb-1 block text-[12px] font-medium text-muted';
const FIELD_HINT_CLASS = 'mt-1 text-[11px] italic text-muted';

/**
 * Type-driven renderer for a single step. Picks the editor based on
 * `step.kind` — the Wizard stays declarative.
 *
 * `intro` steps render their welcome body and do not touch the
 * payload; the Wizard's « Suivant → » button is the only way out.
 */
export default function SectionForm({ step, value, onChange }: SectionFormProps) {
  switch (step.kind) {
    case 'intro':
      return (
        <div className="space-y-4 text-[15px] leading-[1.65] text-ink-soft">
          {step.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      );

    case 'textarea':
      return (
        <div>
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            {...(step.placeholder ? { placeholder: step.placeholder } : {})}
            rows={8}
            minHeightPx={180}
          />
          {step.help ? <p className={FIELD_HINT_CLASS}>{step.help}</p> : null}
        </div>
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
              {f.hint ? <p className={FIELD_HINT_CLASS}>{f.hint}</p> : null}
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
                {f.hint ? <p className={FIELD_HINT_CLASS}>{f.hint}</p> : null}
              </div>
            );
          })}
        </div>
      );
    }

    case 'keyed_mixed': {
      const obj = (value ?? {}) as Record<string, unknown>;
      return (
        <div className="space-y-5">
          {step.fields.map((f) => (
            <MixedField
              key={f.key}
              field={f}
              value={obj[f.key]}
              onChange={(next) => onChange({ ...obj, [f.key]: next })}
            />
          ))}
        </div>
      );
    }
  }
}

interface MixedFieldProps {
  field: MixedKeyLabel;
  value: unknown;
  onChange: (next: unknown) => void;
}

function MixedField({ field, value, onChange }: MixedFieldProps) {
  return (
    <div>
      <label className="block">
        <span className={FIELD_LABEL_CLASS}>{field.label}</span>
        <MixedEditor type={field.type} value={value} onChange={onChange} />
      </label>
      {field.hint ? <p className={FIELD_HINT_CLASS}>{field.hint}</p> : null}
    </div>
  );
}

interface MixedEditorProps {
  type: MixedFieldType;
  value: unknown;
  onChange: (next: unknown) => void;
}

function MixedEditor({ type, value, onChange }: MixedEditorProps) {
  if (type === 'list') {
    const list = Array.isArray(value) ? (value as string[]) : [];
    return <StringListEditor value={list} onChange={(next) => onChange(next)} />;
  }
  if (type === 'textarea') {
    return (
      <Textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        minHeightPx={100}
      />
    );
  }
  // 'text' or 'date'
  return (
    <Input
      type={type === 'date' ? 'date' : 'text'}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
