import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/EmptyHint';
import GroupBlock from '@/ui/dirk/GroupBlock';
import PageHeading from '@/ui/dirk/PageHeading';

import { useJournalData, useJournalFilters } from '../context';
import EntryRow from './EntryRow';

/**
 * Main rendering surface — page heading, error / loading / empty
 * states, and the grouped list of entries. Reads `entries` /
 * `load` from data and `groups` / `groupBy` from filters ; no
 * props.
 */
export default function PrimaryColumn() {
  const { t } = useI18n();
  const { entries, load } = useJournalData();
  const { groupBy, groups } = useJournalFilters();
  const groupVariant = groupBy === 'month' ? 'eyebrow' : 'subtitle';

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>{t('passage.title')}</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>{t('passage.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('passage.list.empty')}</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun={t('passage.list.groupCountNoun')}
              variant={groupVariant}
            >
              {items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}
