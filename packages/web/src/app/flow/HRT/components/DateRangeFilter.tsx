/**
 * HRT · DateRangeFilter — a date filter shared by the Administration and
 * Analyses views. A period Select (presets) plus an « Personnalisé »
 * mode that reveals Du / Au date inputs for a precise range.
 *
 * Self-contained : it owns the preset / custom UI state and only emits a
 * resolved `{ from, to }` (ISO `YYYY-MM-DD`, empty string = unbounded)
 * via `onChange`. The caller filters its entries with plain string
 * comparison (ISO dates sort lexicographically). Preset cutoffs are
 * computed from « today » at click time. Emits only on user action, so
 * the caller's initial range must be the unbounded `{ from:'', to:'' }`.
 */
import { useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import DateField from '@/ui/atoms/dirk/DateField';
import Select from '@/ui/atoms/dirk/Select';

import { EMPTY_RANGE, type DateRange } from '../lib/date-range';

interface Preset {
  key: string;
  /** `hrt.dateRange.*` key for the option label. */
  labelKey: string;
  days?: number;
  months?: number;
}

const PRESETS: readonly Preset[] = [
  { key: 'all', labelKey: 'hrt.dateRange.all' },
  { key: '30d', labelKey: 'hrt.dateRange.last30Days', days: 30 },
  { key: '3m', labelKey: 'hrt.dateRange.months3', months: 3 },
  { key: '6m', labelKey: 'hrt.dateRange.months6', months: 6 },
  { key: '12m', labelKey: 'hrt.dateRange.months12', months: 12 },
  { key: 'custom', labelKey: 'hrt.dateRange.custom' },
];

/** ISO `YYYY-MM-DD` for « today » shifted back by the preset's window. */
function cutoffIso(preset: Preset): string {
  const d = new Date();
  if (preset.days) d.setDate(d.getDate() - preset.days);
  if (preset.months) d.setMonth(d.getMonth() - preset.months);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilter({ onChange }: DateRangeFilterProps) {
  const { t } = useI18n();
  const [presetKey, setPresetKey] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function onPreset(key: string): void {
    setPresetKey(key);
    if (key === 'custom') {
      onChange({ from, to });
      return;
    }
    const preset = PRESETS.find((p) => p.key === key);
    onChange(preset && (preset.days || preset.months) ? { from: cutoffIso(preset), to: '' } : EMPTY_RANGE);
  }

  function onCustom(next: DateRange): void {
    setFrom(next.from);
    setTo(next.to);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t('hrt.dateRange.periodAria')}
        borderless
        className="w-auto"
        value={presetKey}
        onChange={(e) => onPreset(e.target.value)}
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {t(p.labelKey)}
          </option>
        ))}
      </Select>
      {presetKey === 'custom' ? (
        <div className="flex items-center gap-1.5">
          <DateField
            ariaLabel={t('hrt.dateRange.fromAria')}
            borderless
            inline
            className="w-auto"
            value={from}
            {...(to ? { max: to } : {})}
            onChange={(iso) => onCustom({ from: iso, to })}
          />
          <span className="text-[12px] text-muted">→</span>
          <DateField
            ariaLabel={t('hrt.dateRange.toAria')}
            borderless
            inline
            className="w-auto"
            value={to}
            {...(from ? { min: from } : {})}
            onChange={(iso) => onCustom({ from, to: iso })}
          />
        </div>
      ) : null}
    </div>
  );
}
