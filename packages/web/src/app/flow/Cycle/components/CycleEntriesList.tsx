/**
 * List of logged cycle days under the views (like every other module's
 * entry list). Newest first ; each row opens the day form for editing.
 */
import { useMemo } from 'react';
import type { CyclePayload } from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import FlowMark from './FlowMark';

interface Props {
  records: ReadonlyArray<DecryptedRecord<CyclePayload>>;
  onSelect: (iso: string) => void;
}

export default function CycleEntriesList({ records, onSelect }: Props) {
  const { t, language } = useI18n();

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.payload.date.localeCompare(a.payload.date)),
    [records],
  );

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-[13px] font-semibold text-ink">{t('cycle.entries.title')}</h2>
      {sorted.length === 0 ? (
        <p className="py-4 text-sm text-muted">{t('cycle.entries.empty')}</p>
      ) : (
        <ul className="divide-y divide-hair">
          {sorted.map((r) => {
            const p = r.payload;
            const dateLabel = new Intl.DateTimeFormat(language, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).format(new Date(`${p.date}T12:00:00`));
            const meta = [p.symptoms.join(', '), p.notes].filter(Boolean).join(' · ');
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.date)}
                  className="flex w-full items-center gap-3 py-2 text-left text-[13px] hover:bg-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="w-28 shrink-0 capitalize text-ink">{dateLabel}</span>
                  <span className="flex w-24 shrink-0 items-center gap-1.5 text-muted">
                    {p.flow ? (
                      <>
                        <FlowMark flow={p.flow} />
                        {t(`cycle.form.flow.${p.flow}`)}
                      </>
                    ) : (
                      <span className="text-muted-soft">—</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted">{meta}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
