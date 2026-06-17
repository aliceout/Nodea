/**
 * HRT · SchedulesPanel — the « Prises récurrentes en cours » block on the
 * Administration page. Lists the active (non-stopped) recurring schedules
 * with their cadence + start, and lets the user edit or stop each.
 * Stopping is the parent's job (it sets `endDate` to today) ; the already
 * generated occurrences stay in the journal. Renders nothing when no
 * series is active. Foldable (like the Mood chart) to reclaim space.
 */
import { useState } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

import type { HrtProductPayload } from '@nodea/shared';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

import { frequencyLabel, formatLogDate } from '../lib/labels';
import type { ScheduleEntry } from '../hooks/use-schedules';
import CollapseToggle from './CollapseToggle';

interface SchedulesPanelProps {
  schedules: ReadonlyArray<ScheduleEntry>;
  productByName: ReadonlyMap<string, HrtProductPayload>;
  onEdit: (schedule: ScheduleEntry) => void;
  onStop: (schedule: ScheduleEntry) => void;
}

export default function SchedulesPanel({
  schedules,
  productByName,
  onEdit,
  onStop,
}: SchedulesPanelProps) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(true);
  // `endDate == null` ⇒ ongoing ; a stopped series carries its end date.
  const active = schedules.filter((s) => s.payload.endDate == null);
  if (active.length === 0) return null;

  return (
    <section className="mb-5 rounded-md border border-hair p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
          {t('hrt.schedule.panelTitle')}
        </h3>
        <CollapseToggle
          open={open}
          onToggle={() => setOpen((o) => !o)}
          label={open ? t('hrt.schedule.hide') : t('hrt.schedule.show')}
        />
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          {/* Up to 3 per row so a handful of active series doesn't eat a
              tall stacked list. Columns are separated by a vertical
              hairline (a left border on every cell but the first), no
              fill. ponytail: the « not-first » rule is exact for one row
              (the common 1–3 case) ; a 4th+ wrapped item gets a stray
              left rule — fine until someone runs many concurrent series. */}
          <ul className="grid grid-cols-1 gap-x-6 gap-y-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((s) => {
              const unit = productByName.get(s.payload.product)?.unit ?? '';
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-2 border-hair sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {s.payload.product}
                      <span className="ml-2 font-normal text-muted">
                        {s.payload.dose}
                        {unit ? ` ${unit}` : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {frequencyLabel(t, s.payload.frequency, s.payload.everyNDays)} ·{' '}
                      {t('hrt.schedule.since', {
                        values: { date: formatLogDate(s.payload.startDate, language) },
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={t('hrt.schedule.editAria')}
                      onClick={() => onEdit(s)}
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="danger-ghost" size="sm" onClick={() => onStop(s)}>
                      {t('hrt.schedule.stop')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
