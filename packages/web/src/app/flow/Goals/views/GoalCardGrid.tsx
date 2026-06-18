import { useI18n } from '@/i18n/I18nProvider.jsx';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import PageHeading from '@/ui/dirk/module/PageHeading';

import { useGoalsData, useGoalsFilters } from '../context';
import GoalCard from './GoalCard';

/**
 * « Cartes » view of Goals — one responsive card grid per group
 * (thread or year, matching the user's `groupBy` choice). Same
 * `GroupBlock` + eyebrow chrome as the list view so the two
 * surfaces stay legible side-by-side : the group label says
 * « we changed bucket », the cards say « here are the entries ».
 *
 * Column count : 1 on mobile, 2 from `sm`, 3 from `lg`. Capped at 3
 * deliberately — 4 columns made the cards narrow enough that the
 * title wrapped on every entry and the note preview turned into a
 * postage stamp. 3 keeps the read-from-a-distance density without
 * stripping legibility.
 *
 * Not virtualised : a typical Goals dataset is 10-50 entries, and
 * cards are tall (~140-200 px) which means a virtualiser would buy
 * very little even at 100+ entries. Easy to add if the dataset
 * ever grows past that.
 */
export default function GoalCardGrid() {
  const { t } = useI18n();
  const { load, stats } = useGoalsData();
  const { groups } = useGoalsFilters();

  return (
    <section className="flex min-w-0 flex-col">
      {/* lg+ only — on mobile the topbar carries the module name. */}
      <PageHeading className="hidden lg:block">{t('goals.title')}</PageHeading>

      {load.status === 'error' ? (
        <InlineAlert className="mb-4">{load.message}</InlineAlert>
      ) : null}

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
            bordered={false}
          >
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((entry) => (
                <li key={entry.id} className="contents">
                  <GoalCard entry={entry} />
                </li>
              ))}
            </ul>
          </GroupBlock>
        ))
      )}
    </section>
  );
}
