import { useI18n } from '@/i18n/I18nProvider.jsx';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupedVirtualList from '@/ui/atoms/layout/GroupedVirtualList';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';

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
      {load.status === 'error' ? (
        <InlineAlert className="mb-4">{load.message}</InlineAlert>
      ) : null}

      <div>
        {load.status === 'loading' && stats.total === 0 ? (
          <EmptyHint>{t('goals.list.loading')}</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>{t('goals.list.empty')}</EmptyHint>
        ) : (
          <GroupedVirtualList
            groups={groups}
            getItemKey={(e) => e.id}
            renderItem={(entry) => <GoalRow entry={entry} />}
            variant="eyebrow"
            estimateRowHeight={64}
          />
        )}
      </div>
    </section>
  );
}
