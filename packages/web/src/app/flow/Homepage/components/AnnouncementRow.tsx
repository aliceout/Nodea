import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AnnouncementResponse } from '@nodea/shared';

import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * One admin-pushed announcement row in the AnnouncementsCard (extracted
 * REFACTO-08). Neutral title + date on the right, optional body, and a ×
 * to dismiss (id appended to the encrypted dismissed-set by the parent).
 */
export default function AnnouncementRow({
  announcement,
  onDismiss,
}: {
  announcement: AnnouncementResponse;
  onDismiss: (id: string) => void;
}) {
  const { t, language } = useI18n();

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[14px] font-semibold leading-snug text-ink">
              {announcement.title}
            </h4>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {formatLongDate(announcement.createdAt, language)}
            </span>
          </div>
          {announcement.body.length > 0 ? (
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.5] text-ink-soft">
              {announcement.body}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => onDismiss(announcement.id)}
          aria-label={t('home.announcements.dismissAria', {
            defaultValue: 'Masquer cette annonce',
          })}
          title={t('home.announcements.dismiss', { defaultValue: 'Masquer' })}
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
