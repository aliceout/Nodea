/**
 * List of logged cycle days under the views (like every other module's
 * entry list). Newest first ; each row opens the day form for editing.
 */
import { useMemo } from 'react';
import type { CyclePayload, MoodScore } from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import NoteBadge from '@/app/flow/Mood/components/NoteBadge';
import FlowMark from './FlowMark';

interface Props {
  records: ReadonlyArray<DecryptedRecord<CyclePayload>>;
  /** `null` = all years (rolling) ; a year scopes the list. */
  year: number | null;
  /** 0-based month ; only applies when a year is selected. */
  month: number | null;
  /** Same-day Mood score per date (cross-reference) ; empty when off/absent. */
  moodByDate: ReadonlyMap<string, MoodScore>;
  onSelect: (iso: string) => void;
}

export default function CycleEntriesList({
  records,
  year,
  month,
  moodByDate,
  onSelect,
}: Props) {
  const { t, language } = useI18n();

  const sorted = useMemo(() => {
    let list = records;
    if (year !== null) {
      list = list.filter((r) => Number(r.payload.date.slice(0, 4)) === year);
      if (month !== null) {
        list = list.filter((r) => Number(r.payload.date.slice(5, 7)) === month + 1);
      }
    }
    return [...list].sort((a, b) => b.payload.date.localeCompare(a.payload.date));
  }, [records, year, month]);

  return (
    <section>
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
              year: '2-digit',
            }).format(new Date(`${p.date}T12:00:00`));
            const meta = [p.symptoms.join(', '), p.notes].filter(Boolean).join(' · ');
            const mood = moodByDate.get(p.date);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.date)}
                  className="flex w-full items-center gap-3 py-2 text-left text-[13px] hover:bg-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="w-32 shrink-0 whitespace-nowrap capitalize text-ink">{dateLabel}</span>
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
                  {/* Same-day Mood score (cross-reference), at the row's end. */}
                  {mood ? (
                    <span className="shrink-0" title={t('cycle.moodNote.title')}>
                      <NoteBadge score={mood} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
