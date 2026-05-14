import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import PageHeading from '@/ui/dirk/module/PageHeading';

import { useJournalData, useJournalFilters } from '../context';
import EntryRow from './EntryRow';
import OnThisDayPanel from './OnThisDayPanel';

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
      <PageHeading>{t('journal.title')}</PageHeading>

      {/* « Il y a un an » — issue #58. Renders only on days when
          past-them left a trail ; returns null otherwise. Sits
          above the grouped list so the user notices it without
          scrolling. */}
      <OnThisDayPanel />

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
          <EmptyHint>{t('journal.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('journal.list.empty')}</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun={t('journal.list.groupCountNoun')}
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
