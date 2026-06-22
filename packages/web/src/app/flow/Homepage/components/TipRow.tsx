import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

import type { LocalTip, LocalTipKind } from '../lib/local-announcements';

/**
 * One client-generated tip row in the AnnouncementsCard (extracted
 * REFACTO-08). Tone-coloured by `tip.kind`; the action is a `<Link>`
 * (when `tip.to` is set) or a flow-module nav button (`tip.module`).
 * Only dismissable tips show the ×.
 */

// Amber for the security-upgrade `warning`, danger red for the data-loss
// `danger`, sage `accent` for info.
const TIP_TITLE: Record<LocalTipKind, string> = {
  info: 'text-accent-deep',
  warning: 'text-amber-700 dark:text-amber-200',
  danger: 'text-danger',
};
const TIP_ACTION: Record<LocalTipKind, string> = {
  info: 'text-accent hover:text-accent-deep',
  warning: 'text-amber-700 hover:text-amber-800 dark:text-amber-200',
  danger: 'text-danger hover:text-danger',
};

export default function TipRow({
  tip,
  onDismiss,
}: {
  tip: LocalTip;
  onDismiss: (id: string) => void;
}) {
  const { t } = useI18n();
  const setModule = useNodeaStore((s) => s.setModule);

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              'text-[14px] font-semibold leading-snug',
              TIP_TITLE[tip.kind],
            )}
          >
            {t(tip.titleKey)}
          </h4>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-soft">
            {t(tip.bodyKey)}{' '}
            {tip.to ? (
              <Link
                to={tip.to}
                className={cn(
                  'font-medium transition-colors hover:underline',
                  TIP_ACTION[tip.kind],
                )}
              >
                {t(tip.actionKey)} →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (tip.module) setModule(tip.module);
                }}
                className={cn(
                  'cursor-pointer font-medium transition-colors hover:underline',
                  TIP_ACTION[tip.kind],
                )}
              >
                {t(tip.actionKey)} →
              </button>
            )}
          </p>
        </div>
        {tip.dismissable ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => onDismiss(tip.id)}
            aria-label={t('home.announcements.dismissAria', {
              defaultValue: 'Masquer cette annonce',
            })}
            title={t('home.announcements.dismiss', { defaultValue: 'Masquer' })}
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
