import { useMemo, type ReactElement } from 'react';
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
} from '@heroicons/react/24/outline';
import type { ActiveSession } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * One row of the « Sessions actives » list (extracted from
 * SessionsCard, REFACTO-08). Owns its own presentation helpers —
 * device-icon heuristic, relative « last seen » phrasing, locale date
 * formatter — so the parent keeps only the load / decrypt / action
 * orchestration. The decrypted device `label` is passed in (the parent
 * holds the label cache); `onRevoke` is disabled implicitly for the
 * current session (the button isn't rendered).
 */
export default function SessionRow({
  session,
  label,
  onRevoke,
}: {
  session: ActiveSession;
  label: string;
  onRevoke: (id: string) => void;
}) {
  const { t, tn, language } = useI18n();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
      }),
    [language],
  );

  function formatLastSeen(): string {
    if (!session.lastSeenAt) return t('account.security.sessions.neverSeen');
    const seen = new Date(session.lastSeenAt).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - seen) / 1000));
    let when: string;
    if (seconds < 60) {
      when = t('account.security.sessions.lastSeenJustNow');
    } else if (seconds < 3600) {
      when = tn('account.security.sessions.lastSeenMinutes', Math.floor(seconds / 60));
    } else if (seconds < 86_400) {
      when = tn('account.security.sessions.lastSeenHours', Math.floor(seconds / 3600));
    } else {
      when = tn('account.security.sessions.lastSeenDays', Math.floor(seconds / 86_400));
    }
    return t('account.security.sessions.lastSeenAt', { values: { when } });
  }

  // Heuristic on the decrypted label — the kind isn't carried over the
  // wire (keeps the cipher payload short). Strings match
  // `parseDeviceLabel`'s outputs.
  function deviceIcon(): ReactElement {
    if (label === 'iPhone' || label.toLowerCase().includes('téléphone'))
      return <DevicePhoneMobileIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
    if (label === 'iPad' || label.toLowerCase().includes('tablette'))
      return <DeviceTabletIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
    return <ComputerDesktopIcon className="h-5 w-5 text-muted" aria-hidden="true" />;
  }

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      {deviceIcon()}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{label}</span>
          {session.isCurrent ? (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-deep">
              {t('account.security.sessions.currentBadge')}
            </span>
          ) : null}
        </div>
        <div className="text-[12px] text-muted">
          {formatLastSeen()} ·{' '}
          {t('account.security.sessions.createdAt', {
            values: { date: dateFormatter.format(new Date(session.createdAt)) },
          })}
        </div>
      </div>
      {!session.isCurrent ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRevoke(session.id)}
          aria-label={t('account.security.sessions.revokeAria')}
        >
          {t('account.security.sessions.revokeCta')}
        </Button>
      ) : null}
    </li>
  );
}
