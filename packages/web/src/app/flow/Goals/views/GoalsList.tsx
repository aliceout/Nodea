import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import PageHeading from '@/ui/dirk/module/PageHeading';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import { useGoalsData, useGoalsFilters } from '../context';
import GoalRow from './GoalRow';

/**
 * « Liste » view of Goals — grouped row list (by thread or year)
 * with virtualised long groups. Was the only Goals surface before
 * the « Cartes » view landed ; PrimaryColumn now picks between this
 * and `GoalCardGrid` based on the persisted `viewMode`.
 */
export default function GoalsList() {
  const { t } = useI18n();
  const { load, stats } = useGoalsData();
  const { groups } = useGoalsFilters();

  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>{t('goals.title')}</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && stats.total === 0 ? (
          <EmptyHint>{t('goals.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('goals.list.empty')}</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun={t('goals.list.groupCountNoun')}
              variant="eyebrow"
              listTag="div"
            >
              <VirtualWindowList
                items={items}
                estimateRowHeight={64}
                getKey={(e) => e.id}
                renderItem={(entry) => <GoalRow entry={entry} />}
              />
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}
