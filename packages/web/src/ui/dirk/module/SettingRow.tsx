import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Select from '@/ui/atoms/dirk/Select';

/**
 * Two-column layout for a panel's setting rows (one column on mobile / narrow
 * panels). Each child is a `SettingSelectRow` / `SettingToggleRow`; the column
 * gap separates the two stacks. Module panels wrap their rows in this so every
 * « Paramètre du module » reads as a compact two-column grid. Full-width items
 * (a section heading, a lone wide toggle) stay OUTSIDE the grid.
 */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">{children}</div>;
}

/**
 * Settings-panel row primitives — Direction K · Sauge.
 *
 * WHAT  The two row shapes every module's « Paramètre du module » panel is built
 *       from: a labelled `<Select>` (an enum default) and a labelled `<Checkbox>`
 *       (an on/off toggle). The label + optional hint sit left, the control right.
 * WHERE `ui/dirk/module/`, beside `ModuleSettingsPanel` — each module's panel body
 *       composes these so every panel reads identically. Factored up front because
 *       the seven panels would otherwise hand-roll the same label+control row
 *       (CLAUDE.md « third copy » rule, applied ahead of a known fan-out).
 * NOTE  Each row wires `htmlFor`/`id` so the label is programmatically tied to its
 *       control (a11y rule: every interactive element has a real label).
 */
function SettingRow({
  id,
  label,
  hint,
  control,
}: {
  id: string;
  label: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    // No row divider: in the 2-col grid `:last-child` is only the last DOM
    // item, so a `border-b` left a half-width line under the left column.
    // Column gap + vertical padding separate the rows on their own.
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[13px] font-medium text-ink">
          {label}
        </label>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-[1.4] text-muted">{hint}</p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

/** A labelled dropdown row — `value` is the current pref, `onChange` writes it. */
export function SettingSelectRow({
  id,
  label,
  hint,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <SettingRow
      id={id}
      label={label}
      {...(hint ? { hint } : {})}
      control={
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-auto shrink-0 text-[12px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      }
    />
  );
}

/** A labelled on/off row — rendered as a « Oui / Non » `<Select>` (reads
 *  cleaner than a bare checkbox in these panels). Keeps a boolean API. */
export function SettingToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <SettingRow
      id={id}
      label={label}
      {...(hint ? { hint } : {})}
      control={
        <Select
          id={id}
          value={checked ? 'yes' : 'no'}
          onChange={(e) => onChange(e.target.value === 'yes')}
          className="w-auto shrink-0 text-[12px]"
        >
          <option value="yes">{t('common.boolean.yes')}</option>
          <option value="no">{t('common.boolean.no')}</option>
        </Select>
      }
    />
  );
}
