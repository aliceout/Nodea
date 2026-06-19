import { useI18n } from '@/i18n/I18nProvider.jsx';
import Tag from '@/ui/dirk/module/Tag';

import { useGoalsActions } from '../context';
import type { GoalEntry } from '../lib/types';

interface StatusPillProps {
  entry: GoalEntry;
}

/**
 * Inline status tag — clicking cycles open → wip → done → open.
 * Reads `cycleStatus` from the actions context. Shares the `Tag`
 * pill look with Journal's thread tags (one sage style across
 * modules) ; the label alone carries the status, so there's no
 * per-status colour or glyph anymore.
 */
export default function StatusPill({ entry }: StatusPillProps) {
  const { t } = useI18n();
  const { cycleStatus } = useGoalsActions();
  const label = t(`goals.status.lower.${entry.status}`);
  return (
    <Tag
      onClick={() => void cycleStatus(entry)}
      ariaLabel={t('goals.statusPill.ariaLabel', { values: { label } })}
      title={t('goals.statusPill.title', { values: { label } })}
    >
      {label}
    </Tag>
  );
}
